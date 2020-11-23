import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { DocumentData } from '@google-cloud/firestore';

if (!admin.apps.length) {
  admin.initializeApp();
}

export default async (
  change: functions.Change<functions.firestore.QueryDocumentSnapshot>,
  context: functions.EventContext
) => {
  const record = getAllData(change.after.data());

  if (!isComplete(record)) {
    return null;
  }

  const batch = admin.firestore().batch();

  // QR Code Record
  const qrCodeDocRef = admin.firestore().doc(`qrcodes/${record.customerId}`);
  const qrCodeDoc = { id: record.code, n: record.fullName, c: record.children };
  await qrCodeDocRef.set(qrCodeDoc);

  // Email Record
  const emailDocRef = admin.firestore().doc(`registrationemails/${record.customerId}`);
  const emailDoc = { code: record.code, email: record.email, name: record.firstName, formattedDateTime: record.dateTime };
  await emailDocRef.set(emailDoc);

  // Registration Search Index Record
  const indexDocRef = admin.firestore().doc(`registrationsearchindex/${record.customerId}`);
  const indexDoc = { code: record.code, customerId: record.customerId, firstName: record.firstName, lastName: record.lastName, zip: record.zipCode };
  await indexDocRef.set(indexDoc);

  return await batch.commit().then(
    response => response[0].isEqual
  ).catch((error: any) => {
    console.error(error);
    throw new Error(error);
  });
};

function isComplete(data: CompletedRegistration): boolean {
  if (!data) return false;
  if (!data.customerId) return false;
  if (!data.email) return false;
  if (!data.firstName) return false;
  if (!data.lastName) return false;
  if (!data.fullName) return false;
  if (!data.code) return false;
  if (!data.dateTime) return false;
  if (!data.zipCode) return false;
  if (!data.children || !data.children.length) return false;
  return true;
}

const getAllData = (data: DocumentData): CompletedRegistration => {
  return {
    customerId: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: data.fullName,
    code: data.code,
    dateTime: data.formattedDateTime,
    zipCode: data.zipCode,
    children: data.children,
  };
};

interface CompletedRegistration {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  code: string;
  dateTime: string;
  zipCode: string;
  children: any[];
}
