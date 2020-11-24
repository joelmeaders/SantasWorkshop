import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';

try {
  admin.initializeApp();
} catch { }

export default async (
  change: functions.Change<functions.firestore.DocumentSnapshot>
) => {

  const storage = admin.storage().bucket('gs://santas-workshop-193b5.appspot.com');

  const oldDocument: any = change.before.data();
  const newDocument: any = change.after.data();

  const oldCode = oldDocument.code;
  const newCode = newDocument.code;

  // Delete the old image file if it exists
  if (oldCode !== newCode) {
    const oldFile = storage.file(`registrations/test/${oldCode}.png`);
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
    n: newDocument.name,
    c: newDocument.children,
  };

  const imageToCreate = storage.file(`registrations/test/${newCode}.png`);
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
  });
};
