import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';
import * as sendgrid from '@sendgrid/mail';

const MAIL_API_KEY = functions.config().sendgrid.key;
sendgrid.setApiKey(MAIL_API_KEY);

admin.initializeApp();

/**
 * Validate recaptcha response.
 *
 * @remarks
 * Callable functions need to specify return instead of await
 */
export const verifyRecaptcha =
  functions.https.onCall(async (request, context) => {
    return (await import('./fn/verifyRecaptcha')).default(request);
  }
);

export const isAdmin =
  functions.https.onCall(async (request, context) => {
    return (await import('./fn/isAdmin')).default(request, context);
});

/**
 * Sharded count updater for all collections
 */
export const documentCounterOnCreate = functions.firestore
  .document('{collection}/{docId}')
  .onCreate(async (snapshot, context) => {
    await (await import('./fn/documentCounterOnCreate')).default(context);
  });

/**
 * Sharded count updater for all collections
 */
export const documentCounterOnDelete = functions.firestore
  .document('{collection}/{docId}')
  .onDelete(async (snapshot, context) => {
    await (await import('./fn/documentCounterOnDelete')).default(context);
  });

/**
 * Backs up firestore db every hour to storage bucket
 */
export const scheduledFirestoreBackup = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    await (await import('./fn/scheduledFirestoreBackup')).default();
  });

/**
 * Watches registrations collections for completed registrations
 * and kicks off various document creations and updates to trigger
 * further events.
 *
 * @remarks
 * registration-email, qrcode, RegistrationSearchIndex
 */
export const completeRegistration = functions.firestore
  .document('registrations/{docId}')
  .onUpdate(async (snapshot, context) => {
    await (await import('./fn/completeRegistration')).default(
      snapshot,
      context
    );
  });

export const qrCodesOnCreate = functions.firestore
  .document('qrcodes/{docId}')
  .onCreate(async (change, context) => {
    await (await import('./fn/qrcodes-OnCreate')).default(change, context);
  });

export const qrCodesOnUpdate = functions.firestore
  .document('qrcodes/{docId}')
  .onUpdate(async (change) => {
    await (await import('./fn/qrCodes-OnUpdate')).default(change);
  });

export const qrCodesOnDelete = functions.firestore
  .document('qrcodes/{docId}')
  .onDelete(async (change, context) => {
    await (await import('./fn/qrcodes-OnDelete')).default(change);
  });

export const generateQrCode = functions.firestore
  .document('registrations/{docId}')
  .onWrite(async (change, context) => {

    const oldDocument: any = change.before?.data() || undefined;
    const oldCode = oldDocument?.code || undefined;
    const storage = admin
      .storage()
      .bucket('gs://santas-workshop-193b5.appspot.com');

    if (!change.after.exists) {
      if (oldCode === undefined) {
        return;
      }
      try {
        const oldFile = storage.file(`registrations/${oldCode}.png`);
        await oldFile
          .exists()
          .then(async (exists) => exists ?? (await oldFile.delete()));
        return;
      } catch {
        return;
      }
    }

    const newDocument: any = change.after.data();
    const newCode = newDocument['code'];
    const name = newDocument['name'];
    const children = newDocument['children'];

    // Don't proceed
    if (!newCode || !children?.length || newCode === oldDocument?.code) {
      return;
    }

    const codeObject: any = {
      id: newCode,
      n: name,
      c: children,
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
    const fileStream = file.createWriteStream({
      public: true,
      contentType: 'auto',
      resumable: false,
    });
    const codeContent = JSON.stringify(codeObject);

    await qrcode.toFileStream(fileStream, codeContent, {
      errorCorrectionLevel: 'medium',
      width: 600,
      margin: 3,
    });
  });

export const sendRegistrationEmail2 = functions.firestore
  .document('registrations/{docId}')
  .onWrite((change, context) => {

    const oldDocument: any = change.before.exists
      ? change.before.data()
      : undefined;
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
        displayName: name,
      },
    };

    return sendgrid.send(msg);
  });
