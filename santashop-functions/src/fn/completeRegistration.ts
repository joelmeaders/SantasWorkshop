import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { isRegistrationComplete } from '../utility/registrations';
import { IRegistration } from '../../../santashop-core/src';

admin.initializeApp();

// TODO: CHange to callable http function
export default async (
  change: functions.Change<functions.firestore.QueryDocumentSnapshot>
) => {
  const record: IRegistration = change.after.data();

  if (!isRegistrationComplete(record)) {
    return null;
  }

  const batch = admin.firestore().batch();

  // QR Code Record
  const qrCodeDocRef = admin.firestore().doc(`tmp_gen_qrcodes/${record.code}`);
  // TODO: May not need all of this.
  const qrCodeDoc = {
    uid: record.uid,
    firstName: record.firstName,
    lastName: record.lastName,
    children: record.children,
  };

  await qrCodeDocRef.set(qrCodeDoc);

  // Email Record
  const emailDocRef = admin
    .firestore()
    .doc(`tmp_gen_registrationemails/${record.uid}`);
  // TODO: Format date/time
  const emailDoc = {
    code: record.code,
    email: record.emailAddress,
    name: record.firstName,
    formattedDateTime: record.dateTimeSlot?.dateTime,
  };

  await emailDocRef.set(emailDoc);

  // Registration Search Index Record
  const indexDocRef = admin
    .firestore()
    .doc(`registrationsearchindex/${record.uid}`);

  const indexDoc = {
    code: record.code,
    customerId: record.uid,
    firstName: record.firstName!.toLowerCase(),
    lastName: record.lastName!.toLowerCase(),
    emailAddress: record.emailAddress,
    zip: record.zipCode
  };

  await indexDocRef.set(indexDoc);

  return batch
    .commit()
    .then(() => true)
    .catch((error: any) => {
      console.error(error);
      throw new Error(error);
    });
};
