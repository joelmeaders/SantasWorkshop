import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { OnboardUser, User, Registration, COLLECTION_SCHEMA } from '../models';
import { generateId } from '../utility/id-generation';
import {
	createQrCodeStoragePath,
	deleteQrCode,
	generateQrCode,
} from '../utility/qrcodes';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import {
	CallableValidationError,
	requireBoolean,
	requireCallableData,
	requireEmailAddress,
	requireTrimmedString,
	requireZipCodeValue,
	throwMappedAuthHttpsError,
	withCallableValidation,
} from '../utility/callable-validation';
import { PROGRAM_YEAR } from '../utility/runtime-config';

const log = createFunctionLogger('newAccount');

export default async function newAccount(
	request: CallableRequest<OnboardUser>,
): Promise<string> {
	const data = withCallableValidation(() => {
		const requestData = requireCallableData(request.data);
		const password = requireTrimmedString(
			requestData['password'],
			'Password',
		);
		const passwordConfirmation = requireTrimmedString(
			requestData['password2'],
			'Password confirmation',
		);
		if (password !== passwordConfirmation) {
			throw new CallableValidationError(
				'Password confirmation must match the password.',
			);
		}
		if (password.length < 6 || password.length > 128) {
			throw new CallableValidationError(
				'Password must be between 6 and 128 characters.',
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
			firstName: requireName(
				requestData['firstName'],
				'First name',
			),
			lastName: requireName(
				requestData['lastName'],
				'Last name',
			),
			emailAddress: requireEmailAddress(requestData['emailAddress']),
			password,
			zipCode: requireZipCodeValue(requestData['zipCode']),
			referredBy: requireReferredBy(requestData['referredBy']),
			newsletter: requestData['newsletter'] === true,
		};
	});
	let newUserAccount;

	try {
		newUserAccount = await admin.auth().createUser({
			email: data.emailAddress,
			password: data.password,
			disabled: false,
			displayName: `${data.firstName} ${data.lastName}`,
		});
	} catch (error) {
		log.error(
			'Failed to create auth user during account onboarding',
			{},
			error,
		);
		handleAuthError(error);
	}

	const acceptedLegal = new Date();

	const user: User = {
		firstName: data.firstName,
		lastName: data.lastName,
		emailAddress: data.emailAddress,
		zipCode: data.zipCode,
		acceptedTermsOfService: acceptedLegal,
		acceptedPrivacyPolicy: acceptedLegal,
		version: 1,
		manuallyMigrated: false,
		newsletter: data.newsletter,
		referredBy: data.referredBy,
	};

	const confirmationCode = generateId(8);
	const qrCodeStoragePath = createQrCodeStoragePath(newUserAccount.uid);
	const registration: Registration = {
		uid: newUserAccount.uid,
		firstName: data.firstName,
		lastName: data.lastName,
		emailAddress: data.emailAddress,
		zipCode: data.zipCode,
		qrcode: confirmationCode,
		qrCodeStoragePath,
		programYear: PROGRAM_YEAR,
		qrCodeGeneratedOn: false,
	};

	const userDocument = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${newUserAccount.uid}`);

	const registrationDocument = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${newUserAccount.uid}`);

	const batch = admin.firestore().batch();

	batch.create(userDocument, user);
	batch.create(registrationDocument, registration);

	try {
		await batch.commit();
	} catch (error) {
		await admin.auth().deleteUser(newUserAccount.uid);
		log.error(
			'Failed to create Firestore account records',
			{ uid: newUserAccount.uid },
			error,
		);
		throw new HttpsError(
			'internal',
			'Unable to create account records',
		);
	}

	try {
		await generateQrCode(qrCodeStoragePath, confirmationCode);
		await registrationDocument.set(
			{ qrCodeGeneratedOn: new Date(), qrCodeGenerationFailedOn: false },
			{ merge: true },
		);
	} catch (error) {
		log.error(
			'Failed to finalize QR code generation for new account',
			{ uid: newUserAccount.uid },
			error,
		);
		await deleteQrCode(qrCodeStoragePath).catch(() => undefined);
		await registrationDocument.set(
			{ qrCodeGenerationFailedOn: new Date() },
			{ merge: true },
		);
		await admin.auth().deleteUser(newUserAccount.uid);
		await Promise.all([
			userDocument.delete(),
			registrationDocument.delete(),
		]);
		throw new HttpsError(
			'internal',
			'Unable to finalize account setup',
		);
	}

	return newUserAccount.uid;
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
