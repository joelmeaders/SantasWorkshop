import { HttpsError } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { getStatsDocumentId } from '../utility/runtime-config';

const requireEmulators = (): void => {
	const hosts = [
		'FIRESTORE_EMULATOR_HOST',
		'FIREBASE_AUTH_EMULATOR_HOST',
		'FIREBASE_STORAGE_EMULATOR_HOST',
	];
	if (
		process.env['FUNCTIONS_EMULATOR'] !== 'true' ||
		hosts.some(
			(key) =>
				!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(
					process.env[key] ?? '',
				),
		)
	) {
		throw new HttpsError(
			'failed-precondition',
			'Boundary fixtures require local Auth, Firestore, Storage, and Functions emulators.',
		);
	}
};

const isoDate = (value: unknown): string | null => {
	const date =
		value instanceof Date
			? value
			: typeof value === 'object' &&
				  value !== null &&
				  'toDate' in value &&
				  typeof value.toDate === 'function'
				? (value.toDate() as Date)
				: typeof value === 'string'
					? new Date(value)
					: undefined;
	return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export interface TestRegistrationBoundary {
	uid: string;
	authUserCount: number;
	userDocumentCount: number;
	registrationCount: number;
	ownedQrObjectCount: number;
	qrPaths: string[];
	emailCount: number;
	searchIndexCount: number;
	registration: {
		firstName: string;
		lastName: string;
		emailAddress: string;
		zipCode: string;
		children: unknown[];
		registrationSubmittedOn: string | null;
		cancelledOn: string | null;
		hasCheckedIn: boolean;
		dateTimeSlot: { id: string; dateTime: string | null } | null;
	};
	receipts: {
		id: string;
		operation: string;
		result: boolean;
		completedOn: string | null;
	}[];
	checkinCount: number;
	checkinIds: string[];
	checkinChildCount: number;
	annualCheckin: { customerCount: number; childCount: number };
}

export async function inspectRegistrationBoundary(
	emailAddress: string,
): Promise<TestRegistrationBoundary> {
	requireEmulators();
	if (typeof emailAddress !== 'string' || !emailAddress.includes('@')) {
		throw new HttpsError(
			'invalid-argument',
			'Fixture email address is required.',
		);
	}
	const email = emailAddress.toLowerCase();
	const db = admin.firestore();
	const [authUsers, registrations, users] = await Promise.all([
		admin.auth().listUsers(1000),
		db.collection('registrations').where('emailAddress', '==', email).get(),
		db.collection('users').where('emailAddress', '==', email).get(),
	]);
	if (authUsers.pageToken)
		throw new Error('Boundary fixture exceeded 1000 Auth users.');
	const record = registrations.docs[0];
	if (!record)
		throw new HttpsError(
			'not-found',
			'Fixture registration was not found.',
		);
	const uid = record.id;
	const data = record.data();
	const [files, emails, index, receipts, checkins, stats] = await Promise.all(
		[
			admin
				.storage()
				.bucket()
				.getFiles({ prefix: `registrations/${uid}/` }),
			db
				.collection('tmp_registrationemails')
				.where('registrationUid', '==', uid)
				.get(),
			db
				.collection('registrationsearchindex')
				.where('customerId', '==', uid)
				.get(),
			record.ref.collection('mutationReceipts').get(),
			db.collection('checkins').where('customerId', '==', uid).get(),
			db.collection('stats').doc(getStatsDocumentId('checkin')).get(),
		],
	);
	const totals = { customerCount: 0, childCount: 0 };
	for (const entry of stats.data()?.['dateTimeCount'] ?? []) {
		totals.customerCount += entry.customerCount ?? 0;
		totals.childCount += entry.childCount ?? 0;
	}
	return {
		uid,
		authUserCount: authUsers.users.filter(
			(user) => user.email?.toLowerCase() === email,
		).length,
		userDocumentCount: users.size,
		registrationCount: registrations.size,
		ownedQrObjectCount: files[0].length,
		qrPaths: files[0].map((file) => file.name).sort(),
		emailCount: emails.size,
		searchIndexCount: index.size,
		registration: {
			firstName: data['firstName'],
			lastName: data['lastName'],
			emailAddress: data['emailAddress'],
			zipCode: data['zipCode'],
			children: (data['children'] ?? []).map(
				(child: Record<string, unknown>) => ({
					...child,
					dateOfBirth: isoDate(child['dateOfBirth']),
				}),
			),
			registrationSubmittedOn: isoDate(data['registrationSubmittedOn']),
			cancelledOn: isoDate(data['cancelledOn']),
			hasCheckedIn: data['hasCheckedIn'] === true,
			dateTimeSlot: data['dateTimeSlot']
				? {
						id: data['dateTimeSlot'].id,
						dateTime: isoDate(data['dateTimeSlot'].dateTime),
					}
				: null,
		},
		receipts: receipts.docs
			.map((receipt) => ({
				id: receipt.id,
				operation: receipt.data()['operation'],
				result: receipt.data()['result'],
				completedOn: isoDate(receipt.data()['completedOn']),
			}))
			.sort((a, b) => a.id.localeCompare(b.id)),
		checkinCount: checkins.size,
		checkinIds: checkins.docs.map((checkin) => checkin.id).sort(),
		checkinChildCount: checkins.docs.reduce(
			(total, checkin) =>
				total + (checkin.data()['stats']?.children ?? 0),
			0,
		),
		annualCheckin: totals,
	};
}

export interface TestDateTimeSlotUpdate {
	enabled?: boolean;
	dateTime?: string;
	programYear?: number;
	maxSlots?: number;
	deleted?: boolean;
}

export async function updateDateTimeSlot(
	id: string,
	changes: TestDateTimeSlotUpdate,
): Promise<void> {
	requireEmulators();
	if (typeof id !== 'string' || !id || id.includes('/'))
		throw new HttpsError(
			'invalid-argument',
			'Fixture slot ID is required.',
		);
	const reference = admin.firestore().collection('dateTimeSlots').doc(id);
	if (changes.deleted) {
		await reference.delete();
		return;
	}
	const values: Record<string, unknown> = {};
	for (const field of ['enabled', 'programYear', 'maxSlots'] as const) {
		if (changes[field] !== undefined) values[field] = changes[field];
	}
	if (changes.dateTime !== undefined) {
		const date = isoDate(changes.dateTime);
		if (!date)
			throw new HttpsError(
				'invalid-argument',
				'Fixture slot time is invalid.',
			);
		values['dateTime'] = new Date(date);
	}
	await reference.update(values);
}
