import { EventContext } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { IDateTimeSlot, IRegistration } from '../../../santashop-models/src/lib/models';

admin.initializeApp();

/**
 * This method loads uncounted registrations and updates
 * dateTimeSlots based on the values within. This is the 
 * lite version that won't use as many reads.
 * 
 * @remarks
 * The downside of this method is it won't decrement the
 * reserved spots in each slot if a customer changes
 * their registration.
 * 
 * @param context: EventContext
 * @returns 
 */
export default async (context: EventContext): Promise<string> => {
  
  const dateTimeSlots: IDateTimeSlot[] =
    await loadDateTimeSlots();

  if (!dateTimeSlots.length) {
    return Promise.resolve('No date time slots');
  }

  const registrations: IRegistration[] =
    await loadRegistrations();

  if (!registrations.length) {
    return Promise.resolve('No registrations');
  }

  registrations.forEach(registration => {

    const slotId = registration.dateTimeSlot?.id;
    const slot = dateTimeSlots.find(e => e.id === slotId);

    if (slot !== undefined) {
      slot.slotsReserved = (slot.slotsReserved ?? 0) + 1;
      slot.enabled = slot.slotsReserved < slot.maxSlots;
      registration.includedInCounts = new Date();
    }
  });

  return admin.firestore().runTransaction((transaction) => {
    
    dateTimeSlots.forEach(slot =>{
      const doc = admin.firestore().collection('dateTimeSlots').doc(slot.id!.toString());
      transaction.update(doc, slot);
    });

    registrations.forEach(registration => {
      const doc = admin.firestore().collection('registrations').doc(registration.uid!.toString());
      transaction.update(doc, registration);
    });

    return Promise.resolve('Updated date time slots');
  });
};

const dateTimeSlotQuery = (limit: number, offset: number) =>
  admin.firestore().collection('dateTimeSlots')
  .where('programYear', '==', 2021)
  .limit(limit).offset(offset);

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
    console.info(`DateTimeSlots: Page Offset: ${pageOffset}, Page Size ${pageSize}`);
  } 
  while (pageSize % pageOffset === 0 && pageOffset >= 0);

  return allDateTimeSlots;
};

const registrationQuery = (limit: number, offset: number) =>
  admin.firestore().collection('registrations')
  .where('programYear', '==', 2021)
  .where('dateTimeSlot', '!=', '')
  .where('includedInCounts', '==', false)
  .limit(limit).offset(offset);

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
    console.info(`Registrations: Page Offset: ${pageOffset}, Page Size ${pageSize}`);
  } 
  while (pageSize % pageOffset === 0 && pageOffset >= 0);

  return allRegistrations;
};
