import admin from '../firebase-admin';
import {
	getZonedDateKey,
	User,
	UserStats,
	UsersByZipCodeCount,
	ReferrerCount,
} from '../models';
import { createFunctionLogger } from '../utility/observability';
import {
	getStatsDocumentId,
	PROGRAM_YEAR,
	SHOP_TIME_ZONE,
} from '../utility/runtime-config';
import {
	mergeDailyProfileCounts,
	readStatsDate,
} from '../utility/reporting-stats';

const log = createFunctionLogger('scheduledUserStats');

const normalizeZipCode = (zipCode: User['zipCode']): string => {
	return `${zipCode ?? ''}`.trim().slice(0, 5);
};

const toUser = (data: Record<string, unknown>): User => {
	return data as User;
};

const mapToCountEntries = <TKey extends string>(
	counts: Map<TKey, number>,
	keyName: 'zip' | 'referrer',
): Array<UsersByZipCodeCount | ReferrerCount> => {
	return Array.from(counts.entries()).map(([key, count]) => ({
		[keyName]: key,
		count,
	})) as Array<UsersByZipCodeCount | ReferrerCount>;
};

export default async function scheduledUserStats(): Promise<void> {
	const snapshot = await admin.firestore().collection('users').get();
	const now = new Date();
	const users = snapshot.docs.map((doc) => toUser(doc.data()));
	const dailySignups = new Map<string, number>();
	let signupDatesUnavailable = 0;
	let signupDatesOutsideProgramYear = 0;
	for (const document of snapshot.docs) {
		const createdAt = readStatsDate(document.createTime);
		if (!createdAt || createdAt > now) {
			signupDatesUnavailable += 1;
			continue;
		}
		const dateKey = getZonedDateKey(createdAt, SHOP_TIME_ZONE);
		if (!dateKey.startsWith(`${PROGRAM_YEAR}-`)) {
			signupDatesOutsideProgramYear += 1;
			continue;
		}
		dailySignups.set(dateKey, (dailySignups.get(dateKey) ?? 0) + 1);
	}

	const stats: UserStats = {
		schemaVersion: 2,
		calculatedAt: now,
		programYear: PROGRAM_YEAR,
		population: 'all-users',
		signupCoverage: 'observed-profile-records',
		signupDatesUnavailable,
		signupDatesOutsideProgramYear,
		totalUsers: users.length,
		zipCodeCount: getZipCodeCounts(users),
		referrerCount: getReferrerCounts(users),
	};

	const statsRef = admin
		.firestore()
		.collection('stats')
		.doc(getStatsDocumentId('user'));
	await admin.firestore().runTransaction(async (transaction) => {
		const previous = (await transaction.get(statsRef)).data() as
			UserStats | undefined;
		transaction.set(
			statsRef,
			{
				...stats,
				dailySignups: mergeDailyProfileCounts(
					previous?.dailySignups,
					[...dailySignups].map(([dateKey, count]) => ({
						dateKey,
						count,
					})),
				),
			},
			{ merge: false },
		);
	});

	log.info('Updated user stats document', {
		totalUsers: stats.totalUsers,
		zipCodeBucketCount: stats.zipCodeCount.length,
		referrerBucketCount: stats.referrerCount.length,
	});
}

function getZipCodeCounts(users: User[]): UsersByZipCodeCount[] {
	const counts = new Map<string, number>();

	for (const user of users) {
		const zipCode = normalizeZipCode(user.zipCode) || 'Unknown';
		counts.set(zipCode, (counts.get(zipCode) ?? 0) + 1);
	}

	return mapToCountEntries(counts, 'zip') as UsersByZipCodeCount[];
}

function getReferrerCounts(users: User[]): ReferrerCount[] {
	const counts = new Map<string, number>();

	for (const user of users) {
		const referrer =
			typeof user.referredBy === 'string' && user.referredBy.trim()
				? user.referredBy.trim()
				: 'Unknown';
		counts.set(referrer, (counts.get(referrer) ?? 0) + 1);
	}

	return mapToCountEntries(counts, 'referrer') as ReferrerCount[];
}
