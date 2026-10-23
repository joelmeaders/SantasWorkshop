import { normalizeEmailLanguage } from '../utility/email-templates';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	OnboardUser,
	SIGNUP_PASSWORD_MIN_LENGTH,
	SIGNUP_PASSWORD_MAX_LENGTH,
} from '../models';
import {
	prepareAccountProvisioning,
	finalizeAccountProvisioning,
} from './accountProvisioning';
import { requireMutationId } from './registrationMutationSupport';
import { getErrorCode } from '../utility/errors';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import {
	CallableValidationError,
	requireBoolean,
	requireAuthenticatedUid,
	requireCallableData,
	requireEmailAddress,
	requireTrimmedString,
	requireZipCodeValue,
	throwMappedAuthHttpsError,
	withCallableValidation,
} from '../utility/callable-validation';

const log = createFunctionLogger('newAccount');

export default async function newAccount(
	request: CallableRequest<OnboardUser | { resume: true }>,
): Promise<string> {
	if (
		typeof request.data === 'object' &&
		request.data !== null &&
		'resume' in request.data &&
		request.data.resume === true
	) {
		const uid = requireAuthenticatedUid(request);
		await finalizeAccountProvisioning(uid);
		return uid;
	}
	const data = withCallableValidation(() => {
		const requestData = requireCallableData(request.data);
		const password = requirePassword(requestData['password'], 'Password');
		const passwordConfirmation = requirePassword(
			requestData['password2'],
			'Password confirmation',
		);
		if (password !== passwordConfirmation) {
			throw new CallableValidationError(
				'Password confirmation must match the password.',
			);
		}

		const acceptedLegalTerms = requireBoolean(
			requestData['legal'],
			'Accepted legal terms',
		);
		if (!acceptedLegalTerms) {
			throw new CallableValidationError(
				'Terms of service and privacy policy must be accepted.',
			);
		}

		return {
			mutationId: requireMutationId(requestData['mutationId']),
			preferredLanguage: normalizeEmailLanguage(
				requestData['preferredLanguage'],
			),
			firstName: requireName(requestData['firstName'], 'First name'),
			lastName: requireName(requestData['lastName'], 'Last name'),
			emailAddress: requireEmailAddress(requestData['emailAddress']),
			password,
			zipCode: requireZipCodeValue(requestData['zipCode']),
			referredBy: requireReferredBy(requestData['referredBy']),
			newsletter: requestData['newsletter'] === true,
		};
	});

	try {
		await admin.auth().getUserByEmail(data.emailAddress);
		throw new HttpsError(
			'already-exists',
			'This account already exists. Sign in to continue setup.',
		);
	} catch (error) {
		if (error instanceof HttpsError) throw error;
		if (getErrorCode(error) !== 'auth/user-not-found')
			handleAuthError(error);
	}
	const { password, mutationId, ...profile } = data;
	const uid = await prepareAccountProvisioning(mutationId, profile);
	try {
		await admin.auth().createUser({
			uid,
			email: data.emailAddress,
			password,
			disabled: false,
			displayName: `${data.firstName} ${data.lastName}`,
		});
	} catch (error) {
		log.warn('Signup Auth creation did not return success', {
			uid,
			errorCode: getErrorCode(error),
		});
		handleAuthError(error);
	}
	await finalizeAccountProvisioning(uid);
	return uid;
}

const handleAuthError = (error: unknown): never => {
	throwMappedAuthHttpsError(error, 'Unable to create the account.');
};

const requireName = (value: unknown, label: string): string => {
	const normalized = requireTrimmedString(value, label);
	if (normalized.length > 100) {
		throw new CallableValidationError(
			`${label} must be 100 characters or fewer.`,
		);
	}

	return normalized;
};

const requireReferredBy = (value: unknown): string => {
	const normalized = requireTrimmedString(value, 'Referred by');
	if (normalized.length > 200) {
		throw new CallableValidationError(
			'Referred by must be 200 characters or fewer.',
		);
	}

	if (normalized === 'Other') {
		throw new CallableValidationError(
			'An answer is required when Other is selected.',
		);
	}

	if (!normalized.startsWith('Other:')) return normalized;

	const otherValue = requireTrimmedString(
		normalized.slice('Other:'.length),
		'Other referral answer',
	);
	if (otherValue.length < 3 || otherValue.length > 20) {
		throw new CallableValidationError(
			'Other referral answer must be between 3 and 20 characters.',
		);
	}

	return `Other:${otherValue}`;
};

const requirePassword = (value: unknown, label: string): string => {
	if (typeof value !== 'string')
		throw new CallableValidationError(label + ' must be a string.');
	if (
		value.length < SIGNUP_PASSWORD_MIN_LENGTH ||
		value.length > SIGNUP_PASSWORD_MAX_LENGTH
	) {
		throw new CallableValidationError(
			label +
				' must be between ' +
				SIGNUP_PASSWORD_MIN_LENGTH +
				' and ' +
				SIGNUP_PASSWORD_MAX_LENGTH +
				' characters.',
		);
	}
	return value;
};
