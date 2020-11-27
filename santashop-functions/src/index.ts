import * as functions from 'firebase-functions';

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
  .schedule('every 2 hours')
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
    await (await import('./fn/completeRegistration')).default(snapshot, context);
  });

export const sendRegistrationEmail = functions.firestore
  .document('registrationemails')
  .onWrite(async (snapshot, context) => {
    await (await import('./fn/sendRegistrationEmail')).default(snapshot, context);
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