import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';

admin.initializeApp();

export default async (
  change: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {

  const storage = admin.storage().bucket('gs://santas-workshop-193b5.appspot.com');
  const document: any = change.data();

  const codeObject: any = {
    id: document.id,
    n: document.n,
    c: document.c,
  };

  const imageToCreate = storage.file(`registrations/${codeObject.id}.png`);
  const fileStream = imageToCreate.createWriteStream({
    public: true,
    contentType: 'auto',
    resumable: false,
  });

  const codeContent = JSON.stringify(codeObject);

  await qrcode.toFileStream(fileStream, codeContent, {
    errorCorrectionLevel: 'medium',
    width: 600,
    margin: 3,
  });
};
