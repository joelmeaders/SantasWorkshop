import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { OnboardUser, User, Registration, COLLECTION_SCHEMA } from '../models';
import { generateId } from '../utility/id-generation';
import { deleteQrCode, generateQrCode } from '../utility/qrcodes';
import admin from '../firebase-admin';
import {
	getErrorCode,
	getErrorMessage,
	serializeError,
} from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';

const log = createFunctionLogger('newAccount');

export default async function newAccount(
	request: CallableRequest<OnboardUser>,
): Promise<string> {
	const data = request.data;
	let newUserAccount;

	try {
		newUserAccount = await admin.auth().createUser({
			email: data.emailAddress.toLowerCase(),
			password: data.password,
			disabled: false,
			displayName: `${data.firstName} ${data.lastName}`,
		});
	} catch (error) {
		log.error(
			'Failed to create auth user during account onboarding',
			{ emailAddress: data.emailAddress },
			error,
		);
		handleAuthError(error);
	}

	const acceptedLegal = new Date();

	const user: User = {
		firstName: data.firstName,
		lastName: data.lastName,
		emailAddress: data.emailAddress.toLowerCase(),
		zipCode: data.zipCode,
		acceptedTermsOfService: acceptedLegal,
		acceptedPrivacyPolicy: acceptedLegal,
		version: 1,
		manuallyMigrated: false,
		newsletter: data.newsletter,
	};

	const registration: Registration = {
		uid: newUserAccount.uid,
		firstName: data.firstName,
		lastName: data.lastName,
		emailAddress: data.emailAddress.toLowerCase(),
		zipCode: data.zipCode,
		qrcode: generateId(8),
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
			JSON.stringify(error),
		);
	}

	try {
		await generateQrCode(newUserAccount.uid, registration.qrcode);
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
		await deleteQrCode(newUserAccount.uid).catch(() => undefined);
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

	throw new HttpsError(
		'unknown',
		getErrorCode(error),
		getErrorMessage(error),
	);
};
