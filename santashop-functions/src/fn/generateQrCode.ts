import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';

if (!admin.apps.length) {
  admin.initializeApp();
}

export default async (
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext
) => {
  const oldDocument: any = change.before?.data() || undefined;
  const oldCode = oldDocument?.code || undefined;
  const storage = admin.storage()
    .bucket('gs://santas-workshop-193b5.appspot.com');

  if (!change.after.exists) {
    if (oldCode === undefined) return;
    try {
      const oldFile = storage.file(`registrations/test/${oldCode}.png`);
      await oldFile
        .exists()
        .then(async (exists) => exists ?? (await oldFile.delete()));
      return;
    } catch {
      return;
    }
  }

  const newDocument: any = change.after.data();
  const newCode = newDocument.code;
  const name = newDocument.name;
  const children = newDocument.children;

  // Don't proceed
  if (!newCode || !children?.length || newCode === oldDocument?.code) {
    return;
  }

  const codeObject: any = {
    id: newCode,
    n: name,
    c: children,
  };

  if (!!oldCode && oldCode !== newCode) {
    const oldFile = storage.file(`registrations/test/${oldCode}.png`);
    try {
      await oldFile.exists().then(async (exists) => {
        if (exists) {
          await oldFile.delete();
        }
      });
    } catch {
      // Do nothing
    }
  }

  const file = storage.file(`registrations/test/${newCode}.png`);
  const fileStream = file.createWriteStream({
    public: true,
    contentType: 'auto',
    resumable: false,
  });
  const codeContent = JSON.stringify(codeObject);

  return await qrcode.toFileStream(fileStream, codeContent, {
    errorCorrectionLevel: 'medium',
    width: 600,
    margin: 3,
  });
};
