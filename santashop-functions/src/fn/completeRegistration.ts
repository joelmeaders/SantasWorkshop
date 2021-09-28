import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { isRegistrationComplete } from '../utility/registrations';
import { COLLECTION_SCHEMA, IRegistration } from '../../../santashop-core/src';
import { CallableContext, HttpsError } from 'firebase-functions/v1/https';

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
    includedInCounts: new Date()
  } as Partial<IRegistration>;

  batch.set(registrationDocRef, updateRegistrationFields, { merge: true });

  // Email Record
  const emailDocRef = admin
    .firestore()
    .doc(`tmp_registrationemails/${record.uid}`);
  // TODO: Format date/time
  const emailDoc = {
    code: record.qrcode,
    email: record.emailAddress,
    name: record.firstName,
    formattedDateTime: record.dateTimeSlot?.dateTime,
  };

  // await emailDocRef.set(emailDoc);
  batch.create(emailDocRef, emailDoc);

  // Registration Search Index Record
  const indexDocRef = admin
    .firestore()
    .doc(`registrationsearchindex/${record.uid}`);

  const indexDoc = {
    code: record.qrcode,
    customerId: record.uid,
    firstName: record.firstName!.toLowerCase(),
    lastName: record.lastName!.toLowerCase(),
    emailAddress: record.emailAddress,
    zip: record.zipCode,
  };

  await batch.create(indexDocRef, indexDoc);

  return batch
    .commit()
    .then(() => true) // UPDATE SLOTS TAKEN
    .catch((error: any) => {
      console.error(error);
      throw new Error(error);
    });
};
