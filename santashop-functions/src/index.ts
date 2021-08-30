import * as functions from 'firebase-functions';
import { EventContext } from 'firebase-functions';

// const PROGRAM_YEAR = 2021;

/**
 * Validate recaptcha response.
 *
 * @remarks
 * Callable functions need to specify return instead of await
 */
export const verifyRecaptcha =
  functions.https.onCall(async (request, context) => {
    return (await import('./fn/verifyRecaptcha')).default(request);
  });

export const newAccount =
  functions.https.onCall(async (request, context) => {
    return (await import('./fn/newAccount')).default(request);
  });

// export const isAdmin =
//   functions.https.onCall(async (request, context) => {
//     return (await import("./fn/isAdmin")).default(request, context);
//   });

// export const exportCsv3 = functions.pubsub
//     .schedule("never")
//     .onRun(async () => {
//       return (await import("./fn/exportCsv")).default();
//     });


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
// export const scheduledFirestoreBackup = functions.pubsub
//     .schedule("every 2 hours")
//     .onRun(async (context) => {
//       await (await import("./fn/scheduledFirestoreBackup")).default();
//     });

// export const scheduledRegistrationStats = functions.pubsub
//     .schedule("0 0 * * *")
//     .timeZone("America/Denver")
//     .onRun(async (context) => {
//       await (await import("./fn/scheduledRegistrationStats")).default();
//     });

// Runs every 5 minutes between 10am-4pm, on the 11th, 12th, 14th, 15th of December
// export const scheduledCheckInStats = functions.pubsub
//     .schedule("*/5 10,11,12,13,14,15,16 11,12,14,15 12 *")
//     .timeZone("America/Denver")
//     .onRun(async (context) => {
//       await (await import("./fn/scheduledCheckInStats")).default();
//     });

/**
 * Watches registrations collections for completed registrations
 * and kicks off various document creations and updates to trigger
 * further events.
 *
 * @remarks
 * registration-email, qrcode, RegistrationSearchIndex
 */
// export const completeRegistration = functions.firestore
//     .document("registrations/{docId}")
//     .onUpdate(async (snapshot, context) => {
//       await (await import("./fn/completeRegistration")).default(snapshot, context);
//     });

// export const sendRegistrationEmail = functions.firestore
//     .document("registrationemails/{docId}")
//     .onWrite(async (snapshot, context) => {
//       await (await import("./fn/sendRegistrationEmail")).default(snapshot, context);
//     });

// export const qrCodesOnCreate = functions.firestore
//   .document('qrcodes/{docId}')
//   .onCreate(async (change, context) => {
//     await (await import('./fn/qrcodes-OnCreate')).default(change, context);
//   });

// export const qrCodesOnUpdate = functions.firestore
//     .document("qrcodes/{docId}")
//     .onUpdate(async (change) => {
//       await (await import("./fn/qrCodes-OnUpdate")).default(change);
//     });

// export const qrCodesOnDelete = functions.firestore
//   .document('qrcodes/{docId}')
//   .onDelete(async (change, context) => {
//     await (await import('./fn/qrcodes-OnDelete')).default(change);
//   });

// ------------------------------------- SCHEDULED FUNCTIONS

export const scheduledDateTimeSlotCounters = 
  functions.pubsub.schedule('every 15 minutes')
  .onRun(async (context: EventContext) => {
    await (await import('./fn/dateTimeSlotCountersLite')).default(context);
  });