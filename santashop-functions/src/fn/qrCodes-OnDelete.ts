import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export default async (
  document: functions.firestore.QueryDocumentSnapshot
) => {

  if (!admin.apps.length) {
    admin.initializeApp();
  }
  
  // Delete the qr code
  const storage = admin.storage().bucket('gs://santas-workshop-193b5.appspot.com');
  const imageToDelete = storage.file(`registrations/test/${document.data().code}.png`);

  const exists = await imageToDelete.exists();
  if (!exists[0]) return;

  return imageToDelete.delete()
    .then(() => {
      console.log(`deleted qrcode ${document.data().code}.png`);
      return true;
    }).catch(error => {
      console.error('Error deleting document');
      throw new error(error);
    });
};
