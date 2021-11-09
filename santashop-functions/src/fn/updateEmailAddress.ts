import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {
  COLLECTION_SCHEMA,
  IAuth,
} from '../../../santashop-core/src';
import { HttpsError } from 'firebase-functions/v1/https';

admin.initializeApp();

export default async (
  data: IAuth,
  context: functions.https.CallableContext
): Promise<boolean | HttpsError> => {

  const uid = context.auth?.uid;

  if (!uid) {
    return new functions.https.HttpsError('not-found', 'uid null');
  }

  await admin.auth().updateUser(uid, {
      email: data.emailAddress
  });

  const docData = {
    emailAddress: data.emailAddress.toLowerCase()
  };

  const batch = admin.firestore().batch();

  const userDocumentRef = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.users}/${uid}`);

  batch.set(userDocumentRef, docData, { merge: true });

  const indexDocRef = admin
    .firestore()
    .doc(`registrationsearchindex/${uid}`);

  batch.set(indexDocRef, docData, { merge: true });

  return batch
    .commit()
    .then(() => true)
    .catch((error: any) => {
      console.error(`Error updating email address for ${context.auth?.token.email} to ${data.emailAddress}`, error);
      return new functions.https.HttpsError(
        'internal',
        `Error updating email address for ${context.auth?.token.email} to ${data.emailAddress}`,
        JSON.stringify(error)
      );
    });
};
