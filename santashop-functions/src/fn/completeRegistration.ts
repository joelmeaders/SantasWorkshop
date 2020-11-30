import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getAllRegistrationData, isRegistrationComplete } from '../utility/registrations';

admin.initializeApp();

export default async (
  change: functions.Change<functions.firestore.QueryDocumentSnapshot>,
  context: functions.EventContext
) => {

  const record = getAllRegistrationData(change.after.data());

  if (!isRegistrationComplete(record)) {
    console.log('not complete')
    return null;
  }

  const batch = admin.firestore().batch();

  // QR Code Record
  const qrCodeDocRef = admin.firestore().doc(`qrcodes/${record.customerId}`);
  const qrCodeDoc = { id: record.code, n: record.fullName, c: record.children };
  await qrCodeDocRef.set(qrCodeDoc);

  // Email Record
  const emailDocRef = admin.firestore().doc(`registrationemails/${record.customerId}`);
  const emailDoc = { code: record.code, email: record.email, name: record.firstName, formattedDateTime: record.dateTime };
  await emailDocRef.set(emailDoc);

  // Registration Search Index Record
  const indexDocRef = admin.firestore().doc(`registrationsearchindex/${record.customerId}`);
  const indexDoc = { code: record.code, customerId: record.customerId, firstName: record.firstName.toLowerCase(), lastName: record.lastName.toLowerCase(), zip: record.zipCode };
  await indexDocRef.set(indexDoc);

  return batch.commit().then(
    () => true
  ).catch((error: any) => {
    console.error(error);
    throw new Error(error);
  });
};