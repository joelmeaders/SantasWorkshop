import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTION_SCHEMA, StaffRole, UpdateStaffUser } from '../models';
import admin from '../firebase-admin';
import {
	getErrorCode,
	getErrorMessage,
	serializeError,
} from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import {
	isAdminToken,
	isOwnerToken,
} from '../utility/capabilities';

type FirebaseAuthTokenLike = Record<string, unknown>;

interface StaffAuthUpdate {
	displayName?: string;
	password?: string;
	disabled?: boolean;
}

const log = createFunctionLogger('callableUpdateStaffUser');

const VALID_ROLES = new Set<StaffRole>(['admin', 'checkin']);

const sanitizeRoles = (roles: StaffRole[]): StaffRole[] => {
	for (const role of roles) {
		if (!VALID_ROLES.has(role)) {
			throw new HttpsError(
				'invalid-argument',
				`Unsupported staff role: ${role}`,
			);
		}
	}

	const normalizedRoles = new Set<StaffRole>(roles);
	if (normalizedRoles.has('admin')) {
		normalizedRoles.add('checkin');
	}

	return Array.from(normalizedRoles);
};

const buildAuthUpdate = (data: UpdateStaffUser): StaffAuthUpdate => {
	const authUpdate: StaffAuthUpdate = {};

	if (data.displayName !== undefined) {
		const displayName = data.displayName.trim();
		if (displayName.length < 2) {
			throw new HttpsError(
				'invalid-argument',
				'Display name must be at least 2 characters long',
			);
		}

		authUpdate.displayName = displayName;
	}

	if (data.newPassword !== undefined && data.newPassword.length > 0) {
		if (data.newPassword.length < 8) {
			throw new HttpsError(
				'invalid-argument',
				'Password must be at least 8 characters long',
			);
		}

		authUpdate.password = data.newPassword;
	}

	if (data.disabled !== undefined) {
		authUpdate.disabled = data.disabled;
	}

	return authUpdate;
};

const resolveRoles = (uid: string, roles: StaffRole[]): StaffRole[] => {
	const sanitized = sanitizeRoles(roles);

	if (sanitized.length === 0) {
		throw new HttpsError(
			'invalid-argument',
			'At least one role must be assigned',
		);
	}

	return sanitized;
};

const persistStaffChanges = async (
	uid: string,
	authUpdate: StaffAuthUpdate,
	roles: StaffRole[] | undefined,
): Promise<void> => {
	if (Object.keys(authUpdate).length > 0) {
		await admin.auth().updateUser(uid, authUpdate);
	}

	if (roles !== undefined) {
		await admin.auth().setCustomUserClaims(uid, {
			roles,
			admin: roles.includes('admin'),
		});
	}

	const staffUpdate: Record<string, unknown> = { updatedOn: new Date() };

	if (authUpdate.displayName !== undefined) {
		staffUpdate['displayName'] = authUpdate.displayName;
	}

	if (authUpdate.disabled !== undefined) {
		staffUpdate['disabled'] = authUpdate.disabled;
	}

	if (roles !== undefined) {
		staffUpdate['roles'] = roles;
	}

	await admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.staff}/${uid}`)
		.set(staffUpdate, { merge: true });
};

const assertStaffAccountExists = async (uid: string): Promise<void> => {
	const snapshot = await admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.staff}/${uid}`)
		.get();

	if (!snapshot.exists) {
		throw new HttpsError('not-found', 'Staff account not found');
	}
};

export default async function callableUpdateStaffUser(
	request: CallableRequest<UpdateStaffUser>,
): Promise<void> {
	const actorToken = request.auth?.token as FirebaseAuthTokenLike | undefined;
	if (!isAdminToken(actorToken)) {
		log.warn('Non-admin attempted to update a staff account', {
			actorUid: request.auth?.uid ?? null,
			targetStaffUid: request.data?.uid ?? null,
		});
		throw new HttpsError(
			'permission-denied',
			'You do not have permission to manage staff accounts',
		);
	}

	const data = request.data;
	const uid = data?.uid;

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
	const requestedAdmin =
		data.roles?.includes('admin') ??
		isAdminToken(targetClaims);
	if (
		(isOwnerToken(targetClaims) ||
			isAdminToken(targetClaims) ||
			requestedAdmin) &&
		!isOwnerToken(actorToken)
	) {
		throw new HttpsError(
			'permission-denied',
			'Only a project owner may alter an administrator account.',
		);
	}

	const authUpdate = buildAuthUpdate(data);
	const roles =
		data.roles !== undefined ? resolveRoles(uid, data.roles) : undefined;

	try {
		await persistStaffChanges(uid, authUpdate, roles);
	} catch (error) {
		log.error('Failed to update staff account', { uid }, error);

		if (getErrorCode(error) === 'auth/email-already-exists') {
			throw new HttpsError(
				'already-exists',
				getErrorCode(error),
				getErrorMessage(error),
			);
		}

		throw new HttpsError(
			'internal',
			'Unable to update staff account',
			serializeError(error),
		);
	}
}
