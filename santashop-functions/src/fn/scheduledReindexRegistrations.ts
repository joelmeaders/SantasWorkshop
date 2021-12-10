import * as admin from 'firebase-admin';
import { IRegistration, RegistrationSearchIndex } from '../../../santashop-models/src/lib/models';

admin.initializeApp();

export default async (): Promise<string> => {
  
  // Load all registrations
  const registrations: RegistrationSearchIndex[] =
    await loadRegistrations();

  if (!registrations.length)
    return Promise.resolve('No registrations');

  registrations.forEach(registration => {
    registration.firstName = registration.firstName?.toLowerCase();
    registration.lastName = registration.lastName?.toLowerCase();
  });

  return admin.firestore().runTransaction((transaction) => {
    registrations.forEach(registration => {
      const doc = admin.firestore().collection('registrationsearchindex').doc(registration.customerId.toString());
      transaction.update(doc, registration);
    });

    return Promise.resolve('Updatedindex');
  });
};

const indexQuery = () =>
  admin.firestore().collection('registrationsearchindex');

const loadRegistrations = async (): Promise<RegistrationSearchIndex[]> => {
  let allRegistrations: RegistrationSearchIndex[] = [];

  const snapshotDocs = await indexQuery().get();
    
    snapshotDocs.docs.forEach((doc) => {
        const slot = {
            ...doc.data()
        } as RegistrationSearchIndex;

        allRegistrations = allRegistrations.concat(slot);
    });

  return allRegistrations;
};
