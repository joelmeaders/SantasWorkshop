import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

type AuthToken = Record<string, unknown>;

const rolesFromToken = (token: AuthToken): string[] =>
	Array.isArray(token['roles'])
		? token['roles'].filter(
				(role: unknown): role is string => typeof role === 'string',
			)
		: [];

export const isOwnerToken = (token: AuthToken | undefined): boolean =>
	token?.['owner'] === true;

export const isAdminToken = (token: AuthToken | undefined): boolean =>
	isOwnerToken(token) ||
	token?.['admin'] === true ||
	rolesFromToken(token ?? {}).includes('admin');

export const canCheckInToken = (token: AuthToken | undefined): boolean =>
	isAdminToken(token) || rolesFromToken(token ?? {}).includes('checkin');

export const requireOwner = (
	request: CallableRequest<unknown>,
): { uid: string; token: AuthToken } => {
	const uid = request.auth?.uid;
	const token = request.auth?.token as AuthToken | undefined;

	if (!uid) {
		throw new HttpsError('unauthenticated', 'Authentication is required.');
	}

	if (!isOwnerToken(token)) {
		throw new HttpsError(
			'permission-denied',
			'Project owner access is required.',
		);
	}

	return { uid, token: token ?? {} };
};

export const requireRecentAuthentication = (
	token: AuthToken,
	now = new Date(),
	maxAgeSeconds = 300,
): void => {
	const authTime = token['auth_time'];
	if (
		typeof authTime !== 'number' ||
		now.getTime() / 1000 - authTime > maxAgeSeconds
	) {
		throw new HttpsError(
			'failed-precondition',
			'Reauthentication is required before starting this operation.',
		);
	}
};
