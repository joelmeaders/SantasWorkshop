import * as functions from 'firebase-functions';
import * as firestore from '@google-cloud/firestore';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';
import * as nodeMailer from 'nodemailer';

admin.initializeApp();

export const trackCollectionMeta = functions.firestore.document('{collection}/{docId}').onWrite(async (change, context) => {

  if (change.before.exists && change.after.exists) {
    return;
  }

  const collection = context.params.collection;

  if (collection === 'counters' || collection === 'errors' || collection === 'collection-meta') {
    return;
  }

  // if (!change.before.exists) {
  //   // Created
  // }

  // if (!change.after.exists) {
  //   // Deleted
  // }

  const metaDoc = admin.firestore().doc(`collection-meta/${collection}`);

  const data = {
    collectionLastUpdated: firestore.FieldValue.serverTimestamp()
  };

  await metaDoc.set(data, { merge: true });

});

export const modCounter = functions.https.onCall(async (data, context) => {

  let shardCount = data.shardCount;
  let collection = data.collection;
  let modCountBy = Number(data.adjustBy);

  const errorDoc = admin.firestore().doc(`errors/counters/${collection}/${new Date().toISOString()}`);

  if (!(shardCount && collection && modCounter) || isNaN(modCountBy) || shardCount <= 0) {
    shardCount = shardCount || null;
    collection = collection || null;
    modCountBy = modCountBy || NaN;
    await errorDoc.set(
      {
        action: 'changeCounter',
        error: 'shardCount, collection, ',
        timestamp: new Date().toISOString(),
        info: { shardCount, collection, modCounter }
      }
    ).then(() => {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'shardCount, collection or modCounter error',
        { shardCount, collection, modCounter }
      );
    });
  }

  try {
    const split = Math.floor(modCountBy / shardCount);
    const remainder = modCountBy - (split * shardCount);
    const modValuesArray = new Array<number>();

    for (let index = 0; index < shardCount; index++) {
      modValuesArray[index] = split;
    }

    if (remainder) {
      modValuesArray[0] += remainder;
    }

    const batch = admin.firestore().batch();

    modValuesArray.forEach((value, index) => {
      const doc = admin.firestore().doc(`counters/${collection}/shards/${index}`);
      batch.set(doc, { count: firestore.FieldValue.increment(value) }, { merge: true });
    });

    await batch.commit().then(res => {
      return { status: res };
    }).catch(e => {
      throw new functions.https.HttpsError('aborted', JSON.stringify(e), { shardCount, collection, modCountBy });
    });

  } catch (e) {

    await errorDoc.set({ 
      action: 'modCounter',
      error: JSON.stringify(e), timestamp: new Date().toISOString(),
      info: { shardCount, collection, modCountBy } 
    }, { merge: true }).then(() => {
      throw new functions.https.HttpsError('unknown', e, { shardCount, collection, modCountBy });
    });
  }

});

export const generateQrCode = functions.firestore.document('{registrations}/{docId}').onWrite(async (change, context) => {

  const oldDocument: any = change.before.data();
  const newDocument: any = change.after.data();

  const oldCode = !!oldDocument ? oldDocument['code'] : undefined;

  const storage = admin.storage().bucket('gs://santas-workshop-193b5.appspot.com');

  if (context.eventType === 'google.firestore.document.delete') {
    const oldFile = storage.file(`registrations/${oldCode}.png`);
    await oldFile.exists().then(async (exists) => exists ?? await oldFile.delete());
    return;
  }

  const newCode = newDocument['code'];
  const name = newDocument['name'];
  const children = newDocument['children'];

  // Don't proceed
  if (!newCode || !children?.length || newCode === oldCode) {
    return;
  }

  const codeObject: any = {
    id: newCode,
    n: name,
    c: children
  };

  if (!!oldCode && oldCode !== newCode) {
    const oldFile = storage.file(`registrations/${oldCode}.png`);
    await oldFile.exists().then(async (exists) => {
      if (exists) {
        await oldFile.delete();
      }
    });
  }

  const file = storage.file(`registrations/${newCode}.png`);
  const fileStream = file.createWriteStream({ public: true, contentType: 'auto', resumable: false });
  const codeContent = JSON.stringify(codeObject);

  await qrcode.toFileStream(fileStream, codeContent, { errorCorrectionLevel: 'medium', width: 600, margin: 3 });

});

export const sendRegistrationEmail = functions.firestore.document('{registrations}/{docId}').onWrite(async (change, context) => {
  
  const oldDocument: any = change.before.data();
  const newDocument: any = change.after.data();
  const oldCode = !!oldDocument ? oldDocument['code'] : undefined;

  if (context.eventType === 'google.firestore.document.delete') {
    return;
  }

  const code = newDocument['code'];
  const name = newDocument['name'];
  const email = newDocument['email'];

  // Don't proceed
  if (!code || !email?.length || code === oldCode) {
    return;
  }

  // Send Email
  const transporter = nodeMailer.createTransport({
    host: 'mail.denversantaclausshop.org',
    port: 465,
    secure: true,
    auth: {
      user: 'noreply@denversantaclausshop.org',
      pass: `()*&*theLongwindingRoadyouredriving75`
    },
    pool: true,
    tls: {
      // do not fail on invalid certs
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `noreply@denversantaclausshop.org`,
    to: email,
    subject: 'Santa Claus Shop Registration Confirmation',
    html: `<h1>You're registered, ${name}!</h1>
     <h2>Confirmation Code: ${code}</h2>
     <img src="https://storage.googleapis.com/santas-workshop-193b5.appspot.com/registrations/${code}.png" alt="scannable qr code">
     <p>
      <h4>December 11-12 & 14-15, 2020</h4>
      <h4>9:00am - 3:00pm</h4>
      <h4>2150 S Monaco Parkway</h4>
      <h4>Denver, CO 80222</h4>
     </p>
     <p>
      NEED INSTRUCTIONS
     </p>
     `
  };

  await transporter.sendMail(mailOptions);

});

export const deleteAccount = functions.https.onCall(async (data, context) => {

  const userId = context.auth?.uid;

  // If there is a uid, delete account
  if (!!userId) {
    await admin.auth().deleteUser(userId);
    return Promise.resolve();
  }

  // otherwise look look up account
  const email = data?.email;

  if (!!email) {
    return;
  }

  const account = await admin.auth().getUserByEmail(email);
  await admin.auth().deleteUser(account.uid);

  return Promise.resolve();

});
