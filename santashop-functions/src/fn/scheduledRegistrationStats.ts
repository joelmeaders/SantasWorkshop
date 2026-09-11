import type { Timestamp } from 'firebase-admin/firestore';
import admin from '../firebase-admin';
import {
	AgeGroup,
	AgeGroupBreakdown,
	RegistrationDateTimeStats,
	GenderAgeStats,
	Registration,
	RegistrationStats,
	ZipCodeCount,
	getZonedDateKey,
} from '../models';
import { normalizeDateTime } from '../utility/date-time-format';
import { createFunctionLogger } from '../utility/observability';
import {
	getStatsDocumentId,
	PROGRAM_YEAR,
	SHOP_TIME_ZONE,
} from '../utility/runtime-config';
import {
	appendDailyRegistrationSnapshot,
	calculateOperationalStats,
	readStatsDate,
} from '../utility/reporting-stats';

const log = createFunctionLogger('scheduledRegistrationStats');

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
): RegistrationDateTimeStats => ({
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
	const [registrationsSnapshots, checkinsSnapshot, cancellationsSnapshot] =
		await Promise.all([
			registrationQuery().get(),
			admin.firestore().collection('checkins').get(),
			admin
				.firestore()
				.collection('cancellations')
				.where('programYear', '==', PROGRAM_YEAR)
				.get(),
		]);
	const now = new Date();
	const records = registrationsSnapshots.docs.map((doc) => ({
		id: doc.id,
		data: toRegistration(doc.data()),
	}));
	// Preserve the original submitted-registration population of the demographics report.
	const registrations = records
		.map(({ data }) => data)
		.filter(
			(record) =>
				record.programYear === PROGRAM_YEAR &&
				record.registrationSubmittedOn != null &&
				(record.registrationSubmittedOn as unknown) !== '',
		);
	const checkedInIds = new Set(
		checkinsSnapshot.docs
			.filter((doc) => {
				const data = doc.data();
				const checkedInOn = readStatsDate(data['checkInDateTime']);
				return (
					data['registrationCode'] !== 'onsite' &&
					checkedInOn &&
					checkedInOn <= now &&
					getZonedDateKey(checkedInOn, SHOP_TIME_ZONE).startsWith(
						`${PROGRAM_YEAR}-`,
					)
				);
			})
			.map((doc) => doc.id),
	);
	const recordedCancellationEvents = cancellationsSnapshot.docs.filter(
		(doc) => {
			const data = doc.data();
			const cancelledOn = readStatsDate(data['cancelledOn']);
			return (
				data['programYear'] === PROGRAM_YEAR &&
				cancelledOn &&
				cancelledOn <= now
			);
		},
	).length;
	const operational = calculateOperationalStats(
		records,
		checkedInIds,
		recordedCancellationEvents,
		PROGRAM_YEAR,
		SHOP_TIME_ZONE,
		now,
	);

	const completedRegistrations = registrations.length;

	const stats: RegistrationStats = {
		schemaVersion: 2,
		calculatedAt: now,
		programYear: PROGRAM_YEAR,
		operational,
		completedRegistrations,
		dateTimeCount: getDateTimeStats(registrations),
		zipCodeCount: getZipCodeStats(registrations),
	};

	const statsRef = admin
		.firestore()
		.collection('stats')
		.doc(getStatsDocumentId('registration'));
	await admin.firestore().runTransaction(async (transaction) => {
		const previous = (await transaction.get(statsRef)).data() as
			RegistrationStats | undefined;
		transaction.set(
			statsRef,
			{
				...stats,
				dailySnapshots: appendDailyRegistrationSnapshot(
					previous?.dailySnapshots,
					operational,
					PROGRAM_YEAR,
					SHOP_TIME_ZONE,
					now,
				),
			},
			{ merge: false },
		);
	});

	log.info('Updated registration stats document', {
		completedRegistrations,
		dateTimeBucketCount: stats.dateTimeCount.length,
		zipCodeBucketCount: stats.zipCodeCount.length,
	});
}

function getDateTimeStats(
	registrations: Registration[],
): RegistrationDateTimeStats[] {
	const stats: RegistrationDateTimeStats[] = [];

	const getIndex = (dateTime: Date) =>
		stats.findIndex((e) => dateTime.getTime() == e.dateTime.getTime());

	registrations.forEach((registration) => {
		const timestamp = registration.dateTimeSlot?.dateTime as
			Timestamp | Date | string | undefined;

		if (!timestamp) {
			log.warn(
				'Skipping registration without a date time slot in stats job',
				{
					uid: registration.uid ?? null,
				},
			);
			return;
		}

		const dateTime = normalizeDateTime(timestamp);
		const children = registration.children ?? [];
		const index = getIndex(dateTime);
		let stat: RegistrationDateTimeStats;

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
		.where('programYear', '==', PROGRAM_YEAR);
