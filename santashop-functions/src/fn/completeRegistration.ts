import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { isRegistrationComplete } from '../utility/registrations';
import { CallableContext, HttpsError } from 'firebase-functions/v1/https';
import { COLLECTION_SCHEMA, IRegistration } from '../../../santashop-models/src/lib/models';
import * as formatDateTime from 'dateformat';

admin.initializeApp();

export default async (record: IRegistration, context: CallableContext): Promise<boolean | HttpsError> => {
  
  if (!isRegistrationComplete(record)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      '-10',
      'Incomplete registration. Cannot continue.'
    );
  }

  if (record.uid !== context.auth?.uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      '-99',
      'You can only update your own records'
    );
  }

  const batch = admin.firestore().batch();

  // Registration
  const registrationDocRef = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.registrations}/${record.uid}`);

  const updateRegistrationFields = {
    registrationSubmittedOn: new Date(),
    includedInCounts: false,
    programYear: 2021
  } as Partial<IRegistration>;

  batch.set(registrationDocRef, updateRegistrationFields, { merge: true });

  // Email Record
  const emailDocRef = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${record.uid}`);

  const date = record.dateTimeSlot?.dateTime;
  const dateZ = date!.toLocaleString('en-US', { timeZone: 'MST' });
  const dateTime = formatDateTime.default(dateZ, 'dddd, mmmm d, h:MM TT');

  const emailDoc = {
    code: record.qrcode,
    email: record.emailAddress,
    name: record.firstName,
    formattedDateTime: dateTime,
  };

  batch.set(emailDocRef, emailDoc, { merge: true });

  // Registration Search Index Record
  const indexDocRef = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${record.uid}`);

  const indexDoc = {
    code: record.qrcode,
    customerId: record.uid,
    firstName: record.firstName!.toLowerCase(),
    lastName: record.lastName!.toLowerCase(),
    emailAddress: record.emailAddress,
    zip: record.zipCode
  };

  batch.set(indexDocRef, indexDoc, { merge: true });

  return batch
    .commit()
    .then(() => true) // UPDATE SLOTS TAKEN
    .catch((error: any) => {
      console.error(error);
      throw new Error(error);
    });
};
