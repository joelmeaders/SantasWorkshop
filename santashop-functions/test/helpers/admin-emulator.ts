import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore, Timestamp } from 'firebase-admin/firestore';
import { afterEach, beforeEach, vi } from 'vitest';
import admin from '../../src/firebase-admin';

const DEFAULT_TEST_PASSWORD = ['Unit', 'Test', '123!'].join('');

const EMULATOR_HOST_ENV_VARS = [
	'FIRESTORE_EMULATOR_HOST',
	'FIREBASE_AUTH_EMULATOR_HOST',
	'FIREBASE_STORAGE_EMULATOR_HOST',
] as const;

const isLoopbackEndpoint = (value: string | undefined): boolean =>
	/^(?:127\.0\.0\.1|::1|\[::1\]):\d+$/u.test(value ?? '');

const assertEmulatorEnvironment = (): void => {
	if (
		EMULATOR_HOST_ENV_VARS.every((name) =>
			isLoopbackEndpoint(process.env[name]),
		)
	) {
		return;
	}

	throw new Error(
		'Integration helpers require Firestore, Auth, and Storage emulators.',
	);
};

// Raw integration handlers run in Vitest, outside the Functions emulator
// process. Select their local adapters explicitly for each test, but only
// after validating every SDK endpoint. Unit suites do not import this helper.
beforeEach(() => {
	assertEmulatorEnvironment();
	vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
});

afterEach(() => vi.unstubAllEnvs());

export const getAdminApp = (): App => {
	assertEmulatorEnvironment();
	return admin.app();
};

export const getFirestore = (): Firestore => getAdminApp().firestore();

export const getAuth = (): Auth => getAdminApp().auth();

export const seedQrCode = async (
	storagePath: string,
	contents = 'integration-test-qr',
): Promise<void> => {
	await getAdminApp()
		.storage()
		.bucket()
		.file(storagePath)
		.save(contents, {
			contentType: 'image/png',
			resumable: false,
			metadata: {
				cacheControl: 'no-store, max-age=0, must-revalidate',
				metadata: {
					firebaseStorageDownloadTokens: 'integration-download-token',
				},
			},
		});
};

export const createTimestamp = (date: Date | string): Timestamp => {
	const resolvedDate = typeof date === 'string' ? new Date(date) : date;
	return admin.firestore.Timestamp.fromDate(resolvedDate);
};

export const seedAuthUser = async (options: {
	uid: string;
	email: string;
	displayName?: string;
	disabled?: boolean;
	password?: string;
	claims?: Record<string, unknown>;
}): Promise<void> => {
	const auth = getAuth();
	await auth.createUser({
		uid: options.uid,
		email: options.email,
		displayName: options.displayName,
		disabled: options.disabled ?? false,
		password: options.password ?? DEFAULT_TEST_PASSWORD,
	});

	if (options.claims) {
		await auth.setCustomUserClaims(options.uid, options.claims);
	}
};

export const setDocument = async (
	collection: string,
	id: string,
	data: Record<string, unknown>,
): Promise<void> => {
	await getFirestore().collection(collection).doc(id).set(data);
};

export const getDocument = async <T extends Record<string, unknown>>(
	collection: string,
	id: string,
): Promise<T | undefined> => {
	const snapshot = await getFirestore().collection(collection).doc(id).get();
	return snapshot.data() as T | undefined;
};

export const getCollectionCount = async (
	collection: string,
): Promise<number> => {
	const snapshot = await getFirestore().collection(collection).get();
	return snapshot.size;
};

export const clearEmulatorData = async (): Promise<void> => {
	assertEmulatorEnvironment();
	const db = getFirestore();
	const auth = getAuth();
	const collections = await db.listCollections();

	for (const collection of collections) {
		await db.recursiveDelete(collection);
	}

	const users: string[] = [];
	let pageToken: string | undefined;
	do {
		const listUsersResult = await auth.listUsers(1000, pageToken);
		users.push(
			...listUsersResult.users.map((userRecord) => userRecord.uid),
		);
		pageToken = listUsersResult.pageToken;
	} while (pageToken);
	await Promise.all(users.map((uid) => auth.deleteUser(uid)));

	await getAdminApp().storage().bucket().deleteFiles({ force: true });
};
