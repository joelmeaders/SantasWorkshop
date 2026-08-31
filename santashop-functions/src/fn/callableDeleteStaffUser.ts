import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTION_SCHEMA, DeleteStaffUser } from '../models';
import admin from '../firebase-admin';
import { serializeError } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import {
	isAdminToken,
	isOwnerToken,
} from '../utility/capabilities';

type FirebaseAuthTokenLike = Record<string, unknown>;

const log = createFunctionLogger('callableDeleteStaffUser');

const assertStaffAccountExists = async (uid: string): Promise<void> => {
	const snapshot = await admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.staff}/${uid}`)
		.get();

	if (!snapshot.exists) {
		throw new HttpsError('not-found', 'Staff account not found');
	}
};

export default async function callableDeleteStaffUser(
	request: CallableRequest<DeleteStaffUser>,
): Promise<void> {
	const actorToken = request.auth?.token as FirebaseAuthTokenLike | undefined;
	if (!isAdminToken(actorToken)) {
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
		throw new HttpsError(
			'invalid-argument',
			'A staff account uid is required',
		);
	}

	await assertStaffAccountExists(uid);

	const targetUser = await admin.auth().getUser(uid);
	const targetClaims = targetUser.customClaims as
		| FirebaseAuthTokenLike
		| undefined;

	if (isOwnerToken(targetClaims)) {
		throw new HttpsError(
			'failed-precondition',
			'Owner accounts must be transferred and revoked outside the app.',
		);
	}

	if (isAdminToken(targetClaims) && !isOwnerToken(actorToken)) {
		throw new HttpsError(
			'permission-denied',
			'Only a project owner may delete an administrator.',
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
		log.error('Failed to delete staff account', { uid }, error);
		throw new HttpsError(
			'internal',
			'Unable to delete staff account',
			serializeError(error),
		);
	}
}
