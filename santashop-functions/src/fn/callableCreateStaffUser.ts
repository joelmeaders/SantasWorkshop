import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	COLLECTION_SCHEMA,
	CreateStaffUser,
	StaffAccount,
	StaffRole,
} from '../models';
import admin from '../firebase-admin';
import { getErrorCode, getErrorMessage, serializeError } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';

type FirebaseAuthTokenLike = Record<string, unknown>;

const isAdminContext = (request: CallableRequest<unknown>): boolean => {
	const token = request.auth?.token as FirebaseAuthTokenLike | undefined;
	return token?.['admin'] === true;
};

const log = createFunctionLogger('callableCreateStaffUser');

const VALID_ROLES = new Set<StaffRole>(['admin', 'checkin']);

const sanitizeRoles = (roles: StaffRole[] | undefined): StaffRole[] => {
	if (!Array.isArray(roles)) {
		return [];
	}

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

const normalizeEmailAddress = (emailAddress: string | undefined): string => {
	const normalized = emailAddress?.trim().toLowerCase();
	const hasWhitespace =
		normalized === undefined
			? true
			: [...normalized].some((character) => character.trim().length === 0);
	const [localPart, domainPart, ...extraParts] = normalized?.split('@') ?? [];
	const hasValidDomain =
		domainPart !== undefined &&
		domainPart.length > 0 &&
		domainPart.includes('.') &&
		!domainPart.startsWith('.') &&
		!domainPart.endsWith('.');

	if (
		!normalized ||
		hasWhitespace ||
		extraParts.length > 0 ||
		!localPart ||
		!hasValidDomain
	) {
		throw new HttpsError(
			'invalid-argument',
			'A valid email address is required',
		);
	}

	return normalized;
};

export default async function callableCreateStaffUser(
	request: CallableRequest<CreateStaffUser>,
): Promise<string> {
	if (!isAdminContext(request)) {
		log.warn('Non-admin attempted to create a staff account', {
			actorUid: request.auth?.uid ?? null,
		});
		throw new HttpsError(
			'permission-denied',
			'You do not have permission to manage staff accounts',
		);
	}

	const data = request.data;
	const emailAddress = normalizeEmailAddress(data?.emailAddress);
	const displayName = data?.displayName?.trim();
	const password = data?.password;
	const roles = sanitizeRoles(data?.roles);

	if (!displayName || !password) {
		throw new HttpsError(
			'invalid-argument',
			'Missing required staff account fields',
		);
	}

	if (displayName.length < 2) {
		throw new HttpsError(
			'invalid-argument',
			'Display name must be at least 2 characters long',
		);
	}

	if (password.length < 8) {
		throw new HttpsError(
			'invalid-argument',
			'Password must be at least 8 characters long',
		);
	}

	if (roles.length === 0) {
		throw new HttpsError(
			'invalid-argument',
			'At least one role must be assigned',
		);
	}

	let newUserAccount;

	try {
		newUserAccount = await admin.auth().createUser({
			email: emailAddress,
			password,
			disabled: false,
			displayName,
		});
	} catch (error) {
		log.error(
			'Failed to create auth user for staff account',
			{ emailAddress },
			error,
		);
		handleAuthError(error);
	}

	try {
		await admin.auth().setCustomUserClaims(newUserAccount.uid, {
			roles,
			admin: roles.includes('admin'),
		});

		const now = new Date();
		const staffAccount: StaffAccount = {
			uid: newUserAccount.uid,
			displayName,
			emailAddress,
			roles,
			disabled: false,
			createdOn: now,
			updatedOn: now,
		};

		await admin
			.firestore()
			.doc(`${COLLECTION_SCHEMA.staff}/${newUserAccount.uid}`)
			.set(staffAccount);
	} catch (error) {
		await admin.auth().deleteUser(newUserAccount.uid);
		log.error(
			'Failed to finalize staff account',
			{ uid: newUserAccount.uid, emailAddress },
			error,
		);
		throw new HttpsError(
			'internal',
			'Unable to create staff account',
			serializeError(error),
		);
	}

	return newUserAccount.uid;
}

const handleAuthError = (error: unknown): never => {
	if (getErrorCode(error) === 'auth/email-already-exists') {
		throw new HttpsError(
			'already-exists',
			getErrorCode(error),
			getErrorMessage(error),
		);
	}

	throw new HttpsError('unknown', getErrorCode(error), getErrorMessage(error));
};
