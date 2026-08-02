import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getErrorCode, getErrorMessage } from './errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_ALREADY_EXISTS_CODES = new Set(['auth/email-already-exists']);
const AUTH_INVALID_ARGUMENT_CODES = new Set([
	'auth/invalid-display-name',
	'auth/invalid-email',
	'auth/invalid-password',
]);
const AUTH_NOT_FOUND_CODES = new Set(['auth/user-not-found']);

export class CallableValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CallableValidationError';
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const requireAuthenticatedUid = (
	request: CallableRequest<unknown>,
): string => {
	if (!request.auth?.uid) {
		throw new HttpsError('unauthenticated', 'User must be authenticated.');
	}

	return request.auth.uid;
};

export const requireCallableData = <T extends Record<string, unknown>>(
	data: unknown,
): T => {
	if (!isRecord(data)) {
		throw new CallableValidationError('Request data must be an object.');
	}

	return data as T;
};

export const requireArray = <T>(value: unknown, label: string): T[] => {
	if (!Array.isArray(value)) {
		throw new CallableValidationError(`${label} must be an array.`);
	}

	return value as T[];
};

export const requireTrimmedString = (value: unknown, label: string): string => {
	if (typeof value !== 'string') {
		throw new CallableValidationError(`${label} must be a string.`);
	}

	const normalized = value.trim();
	if (!normalized) {
		throw new CallableValidationError(`${label} is required.`);
	}

	return normalized;
};

export const requireOptionalTrimmedString = (
	value: unknown,
	label: string,
): string | undefined => {
	if (value === undefined || value === null) {
		return undefined;
	}

	if (typeof value !== 'string') {
		throw new CallableValidationError(`${label} must be a string.`);
	}

	const normalized = value.trim();
	return normalized || undefined;
};

export const requireEmailAddress = (
	value: unknown,
	label = 'Email address',
): string => {
	const emailAddress = requireTrimmedString(value, label).toLowerCase();
	if (!EMAIL_PATTERN.test(emailAddress)) {
		throw new CallableValidationError(
			`${label} must be a valid email address.`,
		);
	}

	return emailAddress;
};

export const requireBoolean = (value: unknown, label: string): boolean => {
	if (typeof value !== 'boolean') {
		throw new CallableValidationError(`${label} must be true or false.`);
	}

	return value;
};

export const requireZipCodeValue = (
	value: unknown,
	label = 'ZIP code',
): number | string => {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			throw new CallableValidationError(
				`${label} must be a valid number.`,
			);
		}

		return value;
	}

	if (typeof value === 'string') {
		const normalized = value.trim();
		if (!normalized) {
			throw new CallableValidationError(`${label} is required.`);
		}

		return normalized;
	}

	throw new CallableValidationError(`${label} is required.`);
};

export const rethrowCallableValidationAsHttpsError = (error: unknown): void => {
	if (error instanceof CallableValidationError) {
		throw new HttpsError('invalid-argument', error.message);
	}
};

export const withCallableValidation = <T>(callback: () => T): T => {
	try {
		return callback();
	} catch (error) {
		rethrowCallableValidationAsHttpsError(error);
		throw error;
	}
};

export const throwMappedAuthHttpsError = (
	error: unknown,
	fallbackMessage: string,
): never => {
	const code = getErrorCode(error);
	const message = getErrorMessage(error);

	if (code && AUTH_ALREADY_EXISTS_CODES.has(code)) {
		throw new HttpsError('already-exists', message);
	}

	if (code && AUTH_INVALID_ARGUMENT_CODES.has(code)) {
		throw new HttpsError('invalid-argument', message);
	}

	if (code && AUTH_NOT_FOUND_CODES.has(code)) {
		throw new HttpsError('not-found', message);
	}

	throw new HttpsError('internal', fallbackMessage, message);
};
