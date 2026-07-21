import admin from '../firebase-admin';
import { User, UserStats, UsersByZipCodeCount, ReferrerCount } from '../models';
import { getStatsDocumentId } from '../utility/runtime-config';

const normalizeZipCode = (zipCode: User['zipCode']): string => {
	return `${zipCode ?? ''}`.slice(0, 5);
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
	const users: User[] = await loadUsers();

	const stats: UserStats = {
		totalUsers: users.length,
		zipCodeCount: getZipCodeCounts(users),
		referrerCount: getReferrerCounts(users),
	};

	await admin
		.firestore()
		.collection('stats')
		.doc(getStatsDocumentId('user'))
		.set(stats, { merge: false });
}

function getZipCodeCounts(users: User[]): UsersByZipCodeCount[] {
	const counts = new Map<string, number>();

	for (const user of users) {
		const zipCode = normalizeZipCode(user.zipCode) || 'not-defined';
		counts.set(zipCode, (counts.get(zipCode) ?? 0) + 1);
	}

	return mapToCountEntries(counts, 'zip') as UsersByZipCodeCount[];
}

function getReferrerCounts(users: User[]): ReferrerCount[] {
	const counts = new Map<string, number>();

	for (const user of users) {
		const referrer = user.referredBy ?? 'not-defined';
		counts.set(referrer, (counts.get(referrer) ?? 0) + 1);
	}

	return mapToCountEntries(counts, 'referrer') as ReferrerCount[];
}

const loadUsers = async (): Promise<User[]> => {
	const snapshotDocs = await admin.firestore().collection('users').get();
	return snapshotDocs.docs
		.map((doc) => toUser(doc.data() as Record<string, unknown>))
		.filter((record) => !!record.referredBy && !!record.zipCode);
};
