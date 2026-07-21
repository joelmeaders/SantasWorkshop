import type { Timestamp } from 'firebase-admin/firestore';
import admin from '../firebase-admin';
import {
	AgeGroup,
	AgeGroupBreakdown,
	DateTimeCount,
	GenderAgeStats,
	Registration,
	ZipCodeCount,
} from '../models';
import { normalizeDateTime } from '../utility/date-time-format';
import { getStatsDocumentId, PROGRAM_YEAR } from '../utility/runtime-config';

interface RegistrationStatsDocument {
	completedRegistrations: number;
	dateTimeCount: DateTimeCount[];
	zipCodeCount: ZipCodeCount[];
}

const toRegistration = (data: Record<string, unknown>): Registration => {
	return data as Registration;
};

const createEmptyGenderAgeStats = (): GenderAgeStats => ({
	infants: { total: 0, age02: 0, age35: 0, age68: 0, age911: 0 },
	girls: { total: 0, age02: 0, age35: 0, age68: 0, age911: 0 },
	boys: { total: 0, age02: 0, age35: 0, age68: 0, age911: 0 },
});

const createDateTimeStat = (
	dateTime: Date,
	childCount: number,
): DateTimeCount => ({
	dateTime,
	count: 1,
	childCount,
	stats: createEmptyGenderAgeStats(),
});

const createZipCodeStat = (zip: number, childCount: number): ZipCodeCount => ({
	zip,
	count: 1,
	childCount,
});

export default async function scheduledRegistrationStats(): Promise<void> {
	const registrationsSnapshots = await registrationQuery().get();
	const registrations: Registration[] = [];

	registrationsSnapshots.forEach((doc) => {
		registrations.push(
			toRegistration(doc.data() as Record<string, unknown>),
		);
	});

	const completedRegistrations = registrations.length;

	const stats: RegistrationStatsDocument = {
		completedRegistrations,
		dateTimeCount: getDateTimeStats(registrations),
		zipCodeCount: getZipCodeStats(registrations),
	};

	await admin
		.firestore()
		.collection('stats')
		.doc(getStatsDocumentId('registration'))
		.set(stats, { merge: false });
}

function getDateTimeStats(registrations: Registration[]): DateTimeCount[] {
	const stats: DateTimeCount[] = [];

	const getIndex = (dateTime: Date) =>
		stats.findIndex((e) => dateTime.getTime() == e.dateTime.getTime());

	registrations.forEach((registration) => {
		const timestamp = registration.dateTimeSlot?.dateTime as
			| Timestamp
			| Date
			| string
			| undefined;

		if (!timestamp) {
			console.log(
				`Registration ${registration.uid} is missing a datetimeslot. Skipping.`,
			);
			return;
		}

		const dateTime = normalizeDateTime(timestamp);
		const children = registration.children ?? [];
		const index = getIndex(dateTime);
		let stat: DateTimeCount;

		if (index === -1) {
			stat = createDateTimeStat(dateTime, children.length);
			setChildGenderStats(stat.stats, registration);
			stats.push(stat);
		} else {
			stats[index].count += 1;
			stats[index].childCount += children.length;
			setChildGenderStats(stats[index].stats, registration);
		}
	});

	return stats;
}

function setChildGenderStats(
	stats: GenderAgeStats,
	registration: Registration,
): void {
	registration.children?.forEach((child) => {
		if (!child.toyType || !child.ageGroup) {
			return;
		}

		setChildAgeStatsByGender(stats[child.toyType], child.ageGroup);
	});
}

function setChildAgeStatsByGender(
	stat: AgeGroupBreakdown,
	ageGroup: AgeGroup,
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
		if (
			registration.zipCode === undefined ||
			registration.zipCode === null
		) {
			return;
		}

		const zipString = registration.zipCode.toString().slice(0, 5);
		const zipCode = Number.parseInt(zipString);
		const index = getIndex(zipCode);

		if (index === -1) {
			stats.push(
				createZipCodeStat(zipCode, registration.children?.length ?? 0),
			);
		} else {
			stats[index].count += 1;
			stats[index].childCount += registration.children?.length ?? 0;
		}
	});

	return stats;
}

const registrationQuery = () =>
	admin
		.firestore()
		.collection('registrations')
		.where('programYear', '==', PROGRAM_YEAR)
		.where('registrationSubmittedOn', '!=', '');
