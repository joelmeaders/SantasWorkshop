import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';
import { IRegistration } from '../../../santashop-core/src';

admin.initializeApp();

export default (
    change: functions.firestore.DocumentSnapshot
) => {
  const storage = admin.storage().bucket('gs://santas-workshop-193b5.appspot.com');
  const document: IRegistration = change.data() as any;

  const codeObject: any = {
    id: document.code
  };

  const imageToCreate = storage.file(`registrations/${codeObject.id}.png`);
  const fileStream = imageToCreate.createWriteStream({
    public: true,
    contentType: 'auto',
    resumable: false,
  });

  const codeContent = JSON.stringify(codeObject);

  return qrcode.toFileStream(fileStream, codeContent, {
    errorCorrectionLevel: 'high',
    width: 600,
    margin: 3,
  });
};
