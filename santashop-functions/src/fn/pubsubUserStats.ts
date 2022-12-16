/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import { User, UserStats, UsersByZipCodeCount, ReferrerCount } from '@models/*';

admin.initializeApp();

export default async () => {
	const users: User[] = await loadUsers();

	const stats: UserStats = {
		totalUsers: users.length,
		zipCodeCount: getZipCodeCounts(users),
		referrerCount: getReferrerCounts(users),
	};

	return admin
		.firestore()
		.collection('stats')
		.doc('user-2022')
		.set(stats, { merge: false });
};

function getZipCodeCounts(users: User[]): UsersByZipCodeCount[] {
	const stats: UsersByZipCodeCount[] = [];
	let valueUndefined = 0;

	const zips = Array.from(new Set(users.map((e) => e.zipCode.slice(0, 5))));
	zips.forEach((e) => {
		if (e?.length) {
			stats.push({ zip: e, count: 0 });
		}
	});

	// Get index of zip
	const getIndex = (zipCode: string) =>
		stats.findIndex((e) => zipCode === e.zip);

	// Increment zip count
	users.forEach((user) => {
		const zipCode = user.zipCode.slice(0, 5) ?? 'not-defined';
		const index = getIndex(zipCode);

		if (index === -1) {
			valueUndefined++;
		} else {
			stats[index].count++;
		}
	});

	if (valueUndefined > 0)
		stats.push({ zip: 'not-defined', count: valueUndefined });

	return stats;
}

function getReferrerCounts(users: User[]): ReferrerCount[] {
	const stats: ReferrerCount[] = [];
	let valueUndefined = 0;

	// Get unique referrers
	const referrers = Array.from(new Set(users.map((e) => e.referredBy)));
	referrers.forEach((e) => {
		if (e?.length) {
			stats.push({ referrer: e!, count: 0 });
		}
	});

	// Get index of referrer
	const getIndex = (referrer: string) =>
		stats.findIndex((e) => referrer === e.referrer);

	users.forEach((user) => {
		const referrer = user.referredBy ?? 'not-defined';
		const index = getIndex(referrer);

		if (index === -1) {
			valueUndefined++;
		} else {
			stats[index].count++;
		}
	});

	if (valueUndefined > 0)
		stats.push({ referrer: 'not-defined', count: valueUndefined });

	return stats;
}

const loadUsers = async (): Promise<User[]> => {
	let allRecords: User[] = [];

	const snapshotDocs = await admin.firestore().collection('users').get();

	snapshotDocs.docs.forEach((doc) => {
		const record = {
			...doc.data(),
		} as User;

		allRecords = allRecords.concat(record);
	});

	return allRecords.filter((e) => !!e.referredBy && !!e.zipCode);
};
