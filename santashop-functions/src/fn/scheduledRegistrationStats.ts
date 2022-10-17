/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import {
	AgeGroup,
	AgeGroupBreakdown,
	DateTimeCount,
	GenderAgeStats,
	Registration,
	ZipCodeCount,
} from '@models/*';

admin.initializeApp();

export default async () => {
	const registrationsSnapshots = await registrationQuery().get();
	const registrations: Registration[] = [];

	registrationsSnapshots.forEach((doc) => {
		const registration = {
			...doc.data(),
		} as Registration;
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
		.set(stats, { merge: false });
};

function getDateTimeStats(registrations: Registration[]): DateTimeCount[] {
	const stats: DateTimeCount[] = [];

	const getIndex = (dateTime: Date) =>
		stats.findIndex((e) => dateTime.getTime() == e.dateTime.getTime());

	registrations.forEach((registration) => {
		const timestamp: admin.firestore.Timestamp = registration.dateTimeSlot!
			.dateTime! as any;
		const dateTime = timestamp.toDate();
		const index = getIndex(dateTime);
		let stat: DateTimeCount;

		if (index === -1) {
			stat = {
				dateTime: dateTime,
				count: 1,
				childCount: registration.children!.length,
				stats: {
					infants: {
						total: 0,
						age02: 0,
						age35: 0,
						age68: 0,
						age911: 0,
					},
					girls: {
						total: 0,
						age02: 0,
						age35: 0,
						age68: 0,
						age911: 0,
					},
					boys: {
						total: 0,
						age02: 0,
						age35: 0,
						age68: 0,
						age911: 0,
					},
				} as GenderAgeStats,
			} as DateTimeCount;
			setChildGenderStats(stat.stats, registration);
			stats.push(stat);
		} else {
			stats[index].count += 1;
			stats[index].childCount += registration.children!.length;
			setChildGenderStats(stats[index].stats, registration);
		}
	});

	return stats;
}

function setChildGenderStats(
	stats: GenderAgeStats,
	registration: Registration
): void {
	registration.children?.forEach((child) => {
		setChildAgeStatsByGender(stats[child.toyType!], child.ageGroup!);
	});
}

function setChildAgeStatsByGender(
	stat: AgeGroupBreakdown,
	ageGroup: AgeGroup
): void {
	if (!stat) return;

	stat.total += 1;

	switch (ageGroup) {
		case AgeGroup.age02:
			stat.age02 += 1;
			break;

		case AgeGroup.age35:
			stat.age35 += 1;
			break;

		case AgeGroup.age68:
			stat.age68 += 1;
			break;

		case AgeGroup.age911:
			stat.age911 += 1;
			break;
	}
}

function getZipCodeStats(registrations: Registration[]): ZipCodeCount[] {
	const stats: ZipCodeCount[] = [];

	const getIndex = (zipCode: number) =>
		stats.findIndex((e) => zipCode === e.zip);

	registrations.forEach((registration) => {
		const zipString = registration.zipCode!.toString().substr(0, 5);
		const zipCode = Number.parseInt(zipString);
		const index = getIndex(zipCode);
		let stat: ZipCodeCount;

		if (index === -1) {
			stat = {
				zip: zipCode,
				count: 1,
				childCount: registration.children!.length,
			} as ZipCodeCount;
			stats.push(stat);
		} else {
			stats[index].count += 1;
			stats[index].childCount += registration.children!.length;
		}
	});

	return stats;
}

const registrationQuery = () =>
	admin
		.firestore()
		.collection('registrations')
		.where('programYear', '==', 2021)
		.where('registrationSubmittedOn', '!=', '');
// .where('includedInRegistrationStats', '==', false);

// DATE

// December 10th

// Boys: 1000
// Age group 0-2: 200
// Age group 0-2: 200
// Age group 0-2: 200
// Age group 0-2: 200

// Girls: 1000

// Infants: 1000

// December 11th
// Boys: 1000
// Girls: 1000
// Infants: 1000
