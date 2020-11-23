import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';

export default async (
  change: functions.firestore.DocumentSnapshot
) => {

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const storage = admin.storage().bucket('gs://santas-workshop-193b5.appspot.com');
  const document: any = change.data();

  const codeObject: any = {
    id: document.code,
    n: document.name,
    c: document.children,
  };

  const imageToCreate = storage.file(`registrations/test/${codeObject.id}.png`);
  const fileStream = imageToCreate.createWriteStream({
    public: true,
    contentType: 'auto',
    resumable: false,
  });

  const codeContent = JSON.stringify(codeObject);

  return qrcode.toFileStream(fileStream, codeContent, {
    errorCorrectionLevel: 'medium',
    width: 600,
    margin: 3,
  }).then(() => {
    console.log(`generated qrcode ${codeObject.id}`);
    return true;
  }).catch(error => {
    console.error(`error creating qrcode ${codeObject.id} for ${document.id}`);
    throw new error(error);
  });
};
