import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v1/https';
import { IDateTimeSlot, IRegistration } from '../../../santashop-models/src/lib/models';

admin.initializeApp();

/**
 * This method loads rescheduled registrations and updates
 * dateTimeSlots based on the values within.
 * 
 * @returns 
 */
export default async (): Promise<string> => {

  // Load all rescheduled registrations
  const registrations: IRegistration[] =
    await loadRegistrations();

  if (!registrations.length)
    return Promise.resolve('No registrations');
  
   // Load all date/time slots 
  const dateTimeSlots: IDateTimeSlot[] =
    await loadDateTimeSlots();

  if (!dateTimeSlots.length)
    return Promise.resolve('No date time slots');

  registrations.forEach(registration => {

    const slotId = registration.previousDateTimeSlot?.id;
    const slot = dateTimeSlots.find(e => e.id === slotId);

    if (slot !== undefined) {
      slot.slotsReserved = (slot.slotsReserved ?? 0) - 1;
      slot.enabled = slot.slotsReserved < slot.maxSlots;
      delete registration.previousDateTimeSlot;
    }
  });

  return admin.firestore().runTransaction((transaction) => {
    
    dateTimeSlots.forEach(slot =>{
      const doc = admin.firestore().collection('dateTimeSlots').doc(slot.id!.toString());
      transaction.set(doc, slot);
    });

    registrations.forEach(registration => {
      const doc = admin.firestore().collection('registrations').doc(registration.uid!.toString());
      transaction.set(doc, registration);
    });

    return Promise.resolve('Updated date time slots');
  })
  .catch(error => {
    throw new HttpsError('aborted', `transaction to update reschedules failed: ${JSON.stringify(error)}`);
  });
};

const dateTimeSlotQuery = (limit: number, offset: number) =>
  admin.firestore().collection('dateTimeSlots')
  .where('programYear', '==', 2021)
  .limit(limit)
  .offset(offset);

const loadDateTimeSlots = async (): Promise<IDateTimeSlot[]> => {
  const pageSize = 50;
  let pageOffset = 0;
  let allDateTimeSlots: IDateTimeSlot[] = [];

  do {
    const snapshotDocs = 
      await dateTimeSlotQuery(pageSize, pageOffset).get();
    
    snapshotDocs.docs.forEach((doc) => {
      const slot = {
        id: doc.id,
        ...doc.data()
      } as IDateTimeSlot;

      allDateTimeSlots = allDateTimeSlots.concat(slot);
    });

    pageOffset = snapshotDocs.docs.length - 1;
  } 
  while (pageSize % pageOffset === 0 && pageOffset >= 0);

  return allDateTimeSlots;
};

const registrationQuery = (limit: number, offset: number) =>
  admin.firestore().collection('registrations')
  .where('programYear', '==', 2021)
  .where('previousDateTimeSlot', '!=', '')
  .limit(limit)
  .offset(offset);

const loadRegistrations = async (): Promise<IRegistration[]> => {
  const pageSize = 50;
  let pageOffset = 0;
  let allRegistrations: IRegistration[] = [];

  do {
    const snapshotDocs = await registrationQuery(pageSize, pageOffset).get();
    
    snapshotDocs.docs.forEach((doc) => {
      const slot = {
        ...doc.data()
      } as IRegistration;

      allRegistrations = allRegistrations.concat(slot);
    });

    pageOffset = snapshotDocs.docs.length - 1;
  } 
  while (pageSize % pageOffset === 0 && pageOffset >= 0);

  return allRegistrations;
};