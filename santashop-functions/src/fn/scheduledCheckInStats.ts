import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase/firestore'

admin.initializeApp();

let stats: ICheckInAggregatedStats;

export default async () => {
  // Get existing stats
  const statsDoc = await admin
      .firestore()
      .collection('stats')
      .doc('checkin-2020')
      .get();

  if (statsDoc.exists) {
    stats = statsDoc.data() as ICheckInAggregatedStats;
    stats.lastUpdated = new Date();
  } else {
    stats = {
      lastUpdated: new Date(),
      dateTimeCount: [],
    };
  }

  // Get unprocessed checkins
  await admin
      .firestore()
      .collection('checkins')
      .where('inStats', '==', false)
      .get()
      .then(async (snapshot) => {
        snapshot.forEach(async (doc) => {
          const docData = doc.data() as ICheckIn;
          updateStats(docData);
          await doc.ref.set({inStats: true}, {merge: true});
        });
      });

  await admin
      .firestore()
      .collection('stats')
      .doc('checkin-2020')
      .set(stats, {merge: false});

  stats = {} as ICheckInAggregatedStats;
  return null;
};

function updateStats(checkIn: ICheckIn): void {
  const localDate = checkIn.checkInDateTime.toDate().toLocaleString('en-US', {timeZone: 'America/Denver'});
  const checkInDate = new Date(localDate).getDate();
  const checkInHour = new Date(localDate).getHours();

  const index = stats.dateTimeCount.findIndex(
      (e) => e.date === checkInDate && e.hour === checkInHour
  );

  if (index > -1) {
    stats.dateTimeCount[index].customerCount += 1;
    stats.dateTimeCount[index].childCount += checkIn.stats.children;
    if (checkIn.stats.preregistered) {
      stats.dateTimeCount[index].pregisteredCount += 1;
    }
    if (checkIn.stats.modifiedAtCheckIn) {
      stats.dateTimeCount[index].modifiedCount += 1;
    }
    return;
  }

  const newItem: ICheckInDateTimeCount = {
    date: checkInDate,
    hour: checkInHour,
    customerCount: 1,
    childCount: checkIn.stats.children,
    pregisteredCount: checkIn.stats.preregistered ? 1 : 0,
    modifiedCount: checkIn.stats.modifiedAtCheckIn ? 1 : 0,
  };

  stats.dateTimeCount.push(newItem);
}

interface ICheckInAggregatedStats {
  lastUpdated: Date;
  dateTimeCount: ICheckInDateTimeCount[];
}

interface ICheckInDateTimeCount {
  date: number;
  hour: number;
  customerCount: number;
  pregisteredCount: number;
  modifiedCount: number;
  childCount: number;
}

interface ICheckIn {
  customerId?: string;
  registrationCode?: string;
  checkInDateTime: Timestamp;
  inStats: boolean;
  stats: ICheckInStats;
}

interface ICheckInStats {
  preregistered: boolean;
  children: number;
  ageGroup02: number;
  ageGroup35: number;
  ageGroup68: number;
  ageGroup911: number;
  toyTypeInfant: number;
  toyTypeBoy: number;
  toyTypeGirl: number;
  zipCode: string;
  modifiedAtCheckIn: boolean;
}
