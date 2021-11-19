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
 * @returns 
 */
export default async (): Promise<string> => {
  
  // Load all registrations that need to be calculated
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

const dateTimeSlotQuery = () =>
  admin.firestore().collection('dateTimeSlots')
  .where('programYear', '==', 2021);

const loadDateTimeSlots = async (): Promise<IDateTimeSlot[]> => {
  let allDateTimeSlots: IDateTimeSlot[] = [];

  const snapshotDocs = 
      await dateTimeSlotQuery().get();
    
    snapshotDocs.docs.forEach((doc) => {
      const slot = {
        id: doc.id,
        ...doc.data()
      } as IDateTimeSlot;

      slot.slotsReserved = 0;

      allDateTimeSlots = allDateTimeSlots.concat(slot);
    });

  return allDateTimeSlots;
};

const registrationQuery = () =>
  admin.firestore().collection('registrations')
  .where('programYear', '==', 2021)
  .where('dateTimeSlot', '!=', '');

const loadRegistrations = async (): Promise<IRegistration[]> => {
  let allRegistrations: IRegistration[] = [];

  const snapshotDocs = await registrationQuery().get();
    
    snapshotDocs.docs.forEach((doc) => {
        const slot = {
            ...doc.data()
        } as IRegistration;

        allRegistrations = allRegistrations.concat(slot);
    });

  return allRegistrations;
};
