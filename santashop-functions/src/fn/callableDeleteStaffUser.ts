import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTION_SCHEMA, DeleteStaffUser } from '../models';
import admin from '../firebase-admin';
import { serializeError } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import { ADMIN_UIDS } from '../utility/runtime-config';

type FirebaseAuthTokenLike = Record<string, unknown>;

const isAdminContext = (request: CallableRequest<unknown>): boolean => {
	const token = request.auth?.token as FirebaseAuthTokenLike | undefined;
	return token?.['admin'] === true;
};

const log = createFunctionLogger('callableDeleteStaffUser');

const PROTECTED_UIDS = new Set<string>(ADMIN_UIDS);

const assertStaffAccountExists = async (uid: string): Promise<void> => {
	const snapshot = await admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.staff}/${uid}`)
		.get();

	if (!snapshot.exists) {
		throw new HttpsError(
			'not-found',
			'Staff account not found',
		);
	}
};

export default async function callableDeleteStaffUser(
	request: CallableRequest<DeleteStaffUser>,
): Promise<void> {
	if (!isAdminContext(request)) {
		log.warn('Non-admin attempted to delete a staff account', {
			actorUid: request.auth?.uid ?? null,
			targetStaffUid: request.data?.uid ?? null,
		});
		throw new HttpsError(
			'permission-denied',
			'You do not have permission to manage staff accounts',
		);
	}

	const uid = request.data?.uid;

	if (!uid) {
		throw new HttpsError('invalid-argument', 'A staff account uid is required');
	}

	await assertStaffAccountExists(uid);

	if (PROTECTED_UIDS.has(uid)) {
		throw new HttpsError(
			'failed-precondition',
			'This account is protected and cannot be deleted',
		);
	}

	if (uid === request.auth?.uid) {
		throw new HttpsError(
			'failed-precondition',
			'You cannot delete your own account',
		);
	}

	try {
		await admin.auth().deleteUser(uid);
		await admin
			.firestore()
			.doc(`${COLLECTION_SCHEMA.staff}/${uid}`)
			.delete();
	} catch (error) {
		log.error(
			'Failed to delete staff account',
			{ uid },
			error,
		);
		throw new HttpsError(
			'internal',
			'Unable to delete staff account',
			serializeError(error),
		);
	}
}
