import * as functions from 'firebase-functions';
import * as firestore from '@google-cloud/firestore';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';
import * as sendgrid from '@sendgrid/mail';

admin.initializeApp();

const MAIL_API_KEY = functions.config().sendgrid.key;
sendgrid.setApiKey(MAIL_API_KEY);

export const documentCounter = functions.firestore.document('{collection}/{docId}').onWrite((change, context) => {

  const collection = context.params.collection;
  const increment = admin.firestore.FieldValue.increment(1);
  const decrement = admin.firestore.FieldValue.increment(-1);
  const shardIndex = Math.floor(Math.random() * 10); 
  let action: firestore.FieldValue;

  if (!change.before.exists) {
    action = increment
  }
  else if (!change.after.exists) {
    action = decrement;
  } else {
    // This is an update. Don't continue
    return;
  }

  const doc = admin.firestore().doc(`counters/${collection}/shards/${shardIndex}`);
  return doc.set({ count: action }, { merge: true });
});

export const generateQrCode = functions.firestore.document('{registrations}/{docId}').onWrite(async (change, context) => {

  const oldDocument: any = change.before.data();
  const newDocument: any = change.after.data();

  const oldCode = change.before.exists ? (oldDocument['code'] ?? undefined) : undefined;

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
    try {
      await oldFile.exists().then(async (exists) => {
        if (exists) {
          await oldFile.delete();
        }
      });
    } catch {
      // Do nothing
    }
  }

  const file = storage.file(`registrations/${newCode}.png`);
  const fileStream = file.createWriteStream({ public: true, contentType: 'auto', resumable: false });
  const codeContent = JSON.stringify(codeObject);

  await qrcode.toFileStream(fileStream, codeContent, { errorCorrectionLevel: 'medium', width: 600, margin: 3 });
});

export const sendRegistrationEmail2 = functions.firestore.document('{registrations}/{docId}').onWrite((change, context) => {

  const oldDocument: any = change.before.exists ? change.before.data() : undefined;
  const document: any = change.after.data();

  if (context.eventType === 'google.firestore.document.delete') {
    return;
  }

  const code = document['code'];
  const name = document['firstName'];
  const email = document['email'];
  const formattedDateTime = document['formattedDateTime'];

  let isNewCode = false;

  if (!!oldDocument && !!oldDocument['code']) {
    isNewCode = oldDocument['code'] !== code;
  } else {
    isNewCode = false;
  }

  // Don't proceed
  if (!code || !email?.length || !isNewCode) {
    return;
  }

  const msg = {
    to: email,
    from: `noreply@denversantaclausshop.org`,
    templateId: 'd-5a8e2828b2c64284965bc4e244026abf',
    dynamic_template_data: {
      registrationCode: code,
      dateTime: formattedDateTime,
      displayName: name
    }
  };

  return sendgrid.send(msg);

});

export const isAdmin = functions.https.onCall((data, context) => {
  return admin.firestore().doc(`parameters/admin`).get().then(
    response => {
      const adminUsers = response.data()?.adminusers as string[];
      return adminUsers.findIndex(user => user === context.auth?.uid) > -1;
    }
  );
});
