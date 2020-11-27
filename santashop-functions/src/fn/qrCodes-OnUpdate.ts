import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';

admin.initializeApp();

export default async (
  change: functions.Change<functions.firestore.DocumentSnapshot>
) => {

  const storage = admin.storage().bucket('gs://santas-workshop-193b5.appspot.com');

  const oldDocument: any = change.before.data();
  const newDocument: any = change.after.data();

  const oldCode = oldDocument.id;
  const newCode = newDocument.id;

  // Delete the old image file if it exists
  if (oldCode !== newCode) {
    const oldFile = storage.file(`registrations/${oldCode}.png`);
    try {
      await oldFile.exists().then(async (exists) => {
        if (exists) {
          await oldFile.delete();
          console.log(`deleted old qrcode ${oldCode}`);
        }
      });
    } catch {
      // Do nothing
    }
  }

  const codeObject: any = {
    id: newCode,
    n: newDocument.n,
    c: newDocument.c,
  };

  const imageToCreate = storage.file(`registrations/${newCode}.png`);
  const fileStream = imageToCreate.createWriteStream({
    public: true,
    contentType: 'auto',
    resumable: false,
  });

  const codeContent = JSON.stringify(codeObject);

  console.log(`creating new code ${newCode}`);

  return qrcode.toFileStream(fileStream, codeContent, {
    errorCorrectionLevel: 'medium',
    width: 600,
    margin: 3,
  });
};
