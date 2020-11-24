import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';

try {
  admin.initializeApp();
} catch { }

export default async (
  change: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {

  console.log(`QRONCREATE: ${JSON.stringify(context)}`)

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

  await qrcode.toFileStream(fileStream, codeContent, {
    errorCorrectionLevel: 'medium',
    width: 600,
    margin: 3,
  });
};
