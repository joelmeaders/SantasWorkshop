import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore, Timestamp } from 'firebase-admin/firestore';
import { COLLECTION_SCHEMA } from '@santashop/models';
import admin from '../../src/firebase-admin';

const DEFAULT_TEST_PASSWORD = ['Unit', 'Test', '123!'].join('');

export const getAdminApp = (): App => {
	return admin.app();
};

export const getFirestore = (): Firestore =>
	getAdminApp().firestore();

export const getAuth = (): Auth => getAdminApp().auth();

export const seedQrCode = async (
	storagePath: string,
	contents = 'integration-test-qr',
): Promise<void> => {
	await getAdminApp().storage().bucket().file(storagePath).save(contents, {
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

export const createTimestamp = (
	date: Date | string,
): Timestamp => {
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
	const db = getFirestore();
	const auth = getAuth();
	const collections = [
		COLLECTION_SCHEMA.users,
		COLLECTION_SCHEMA.registrations,
		COLLECTION_SCHEMA.children,
		COLLECTION_SCHEMA.dateTimeSlots,
		COLLECTION_SCHEMA.parameters,
		COLLECTION_SCHEMA.registrationSearchIndex,
		COLLECTION_SCHEMA.tmpRegistrationEmails,
		COLLECTION_SCHEMA.tmpResendRegistrationEmails,
		COLLECTION_SCHEMA.checkins,
		COLLECTION_SCHEMA.cancellations,
		COLLECTION_SCHEMA.editedRegistrations,
		COLLECTION_SCHEMA.onSiteRegistrations,
		COLLECTION_SCHEMA.stats,
		COLLECTION_SCHEMA.registrationScanAttempts,
		COLLECTION_SCHEMA.registrationScanRiskSummaries,
	];

	for (const collectionName of collections) {
		const snapshot = await db.collection(collectionName).get();
		if (snapshot.empty) {
			continue;
		}

		const batch = db.batch();
		snapshot.docs.forEach((documentSnapshot) => {
			batch.delete(documentSnapshot.ref);
		});
		await batch.commit();
	}

	const listUsersResult = await auth.listUsers();
	await Promise.all(
		listUsersResult.users.map((userRecord) =>
			auth.deleteUser(userRecord.uid),
		),
	);

	await getAdminApp().storage().bucket().deleteFiles({
		prefix: 'registrations/',
		force: true,
	});
};
