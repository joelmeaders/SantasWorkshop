import * as functions from 'firebase-functions';

// const PROGRAM_YEAR = 2021;

/**
 * Validate recaptcha response.
 *
 * @remarks
 * Callable functions need to specify return instead of await
 */
export const verifyRecaptcha2 =
  functions.https.onCall(async (request) => {
    return (await import('./fn/verifyRecaptcha2')).default(request);
  });

export const newAccount =
  functions.https.onCall(async (request) => {
    return (await import('./fn/newAccount')).default(request);
  });

  /**
 * Runs a method to validate and complete a user registration record.
 * This process locks down their selected dateTimeSlot, sends an email
 * and sets the submitted timestamp on their record.
 *
 * @remarks
 * registration-email, RegistrationSearchIndex
 */
export const completeRegistration =
  functions.https.onCall(async (request, context) => {
    return (await import('./fn/completeRegistration')).default(request, context);
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



// ------------------------------------- SCHEDULED FUNCTIONS

export const scheduledDateTimeSlotCounters = 
  functions.pubsub.schedule('every 15 minutes')
  .onRun(async (context: functions.EventContext) => {
    await (await import('./fn/dateTimeSlotCountersLite')).default(context);
  });