import * as admin from 'firebase-admin';
import { IDateTimeCount, IRegistration, IZipCodeCount } from '../../../santashop-models/src/lib/models';

admin.initializeApp();

export default async () => {
  
  const registrationsSnapshots = await registrationQuery().get();
  const registrations: IRegistration[] = [];

  registrationsSnapshots.forEach(doc => {
    const registration = {
      ...doc.data()
    } as IRegistration;
    registrations.push(registration);
  });

  const completedRegistrations = registrations.length;

  // TODO: Read stats record instead of making new one
  const stats: any = {
    completedRegistrations: completedRegistrations,
    dateTimeCount: getDateTimeStats(registrations),
    zipCodeCount: getZipCodeStats(registrations),
  };

  return admin
      .firestore()
      .collection('stats')
      .doc('registration-2021')
      .set(stats, {merge: false});
};

function getDateTimeStats(registrations: IRegistration[]): IDateTimeCount[] {

  const stats: IDateTimeCount[] = [];

  const getIndex = (dateTime: Date) => 
    stats.findIndex(e => dateTime.getTime() == e.dateTime.getTime());

  registrations.forEach(registration => {

    const timestamp: admin.firestore.Timestamp = registration.dateTimeSlot!.dateTime! as any;
    const dateTime = timestamp.toDate();
    const index = getIndex(dateTime);
    let stat: IDateTimeCount;

    if (index === -1) {
      stat = {
        dateTime: dateTime,
        count: 1,
        childCount: registration.children!.length
      } as IDateTimeCount;
      stats.push(stat);
    }
    else {
      stats[index].count += 1;
      stats[index].childCount += registration.children!.length;
    }
  });

  return stats;
}

function getZipCodeStats(registrations: IRegistration[]): IZipCodeCount[] {

  const stats: IZipCodeCount[] = [];

  const getIndex = (zipCode: number) => 
    stats.findIndex(e => zipCode === e.zip);

  registrations.forEach(registration => {

    const zipString = registration.zipCode!.toString().substr(0, 5);
    const zipCode = Number.parseInt(zipString);
    const index = getIndex(zipCode);
    let stat: IZipCodeCount;

    if (index === -1) {
      stat = {
        zip: zipCode,
        count: 1,
        childCount: registration.children!.length
      } as IZipCodeCount;
      stats.push(stat);
    }
    else {
      stats[index].count += 1;
      stats[index].childCount += registration.children!.length;
    }
  });

  return stats;
}

const registrationQuery = () =>
  admin.firestore().collection('registrations')
  .where('programYear', '==', 2021)
  .where('registrationSubmittedOn', '!=', '');
  // .where('includedInRegistrationStats', '==', false);