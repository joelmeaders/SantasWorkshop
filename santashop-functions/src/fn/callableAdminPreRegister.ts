import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	User,
	Registration,
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_KEYS,
	RegistrationSearchIndex,
} from '../models';
import type { Timestamp } from 'firebase-admin/firestore';
import { generateId } from '../utility/id-generation';
import { deleteQrCode, generateQrCode } from '../utility/qrcodes';
import admin from '../firebase-admin';
import {
	formatRegistrationDateTime,
	normalizeDateTime,
} from '../utility/date-time-format';
import {
	getErrorCode,
	getErrorMessage,
	serializeError,
} from '../utility/errors';
import { PROGRAM_YEAR } from '../utility/runtime-config';

interface RegistrationCreationResult {
	qrCode: string;
	formattedDateTime: string;
}

interface FirebaseAuthTokenLike {
	[key: string]: unknown;
}

const isAdminContext = (request: CallableRequest<unknown>): boolean => {
	const token = request.auth?.token as FirebaseAuthTokenLike | undefined;
	return token?.['admin'] === true;
};

const getRequiredString = (
	value: string | undefined,
	label: string,
): string => {
	if (!value) {
		throw new HttpsError('invalid-argument', `Missing required ${label}`);
	}

	return value;
};

export default async function callableAdminPreRegister(
	request: CallableRequest<Registration>,
): Promise<string> {
	const record = request.data;
	const emailAddress = record.emailAddress?.toLowerCase();
	const firstName = record.firstName;
	const lastName = record.lastName;
	const zipCode = record.zipCode;

	if (!isAdminContext(request)) {
		console.error(
			`${request.auth?.uid} attempted to create registration for ${record.emailAddress}`,
		);
		throw new HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}

	if (!emailAddress || !firstName || !lastName || !zipCode) {
		throw new HttpsError(
			'invalid-argument',
			'Missing required registration account fields',
		);
	}

	// Create Account
	let newUserAccount;

	try {
		newUserAccount = await admin.auth().createUser({
			email: emailAddress,
			password: generateId(12),
			disabled: false,
			displayName: `${firstName} ${lastName}`,
		});
	} catch (error) {
		console.error(
			`${record.emailAddress}`,
			new Error(serializeError(error)),
		);
		handleAuthError(error);
	}

	let createdRegistration: RegistrationCreationResult;

	try {
		createdRegistration = await createRegistration(
			record,
			newUserAccount.uid,
		);
	} catch (error: unknown) {
		await admin.auth().deleteUser(newUserAccount.uid);
		const registrationError =
			error instanceof HttpsError
				? error
				: new HttpsError(
						'internal',
						'Failed to create registration after account creation',
					);

		throw new HttpsError(registrationError.code, registrationError.message);
	}

	try {
		await generateQrCode(newUserAccount.uid, createdRegistration.qrCode);
		const finalizedOn = new Date();
		const registrationDocRef = admin
			.firestore()
			.doc(`${COLLECTION_SCHEMA.registrations}/${newUserAccount.uid}`);
		const emailDocRef = admin
			.firestore()
			.doc(
				`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${newUserAccount.uid}`,
			);

		await registrationDocRef.set(
			{
				qrCodeGeneratedOn: finalizedOn,
				qrCodeGenerationFailedOn: false,
				reminderEmailQueuedOn: finalizedOn,
				reminderEmailFailedOn: false,
			},
			{ merge: true },
		);
		await emailDocRef.set(
			{
				code: createdRegistration.qrCode,
				email: emailAddress,
				name: firstName,
				formattedDateTime: createdRegistration.formattedDateTime,
				templateKey:
					EMAIL_TEMPLATE_KEYS.registrationConfirmation,
				queuedOn: finalizedOn,
				queueSource: 'admin-preregistration',
				deliveryRequestedOn: finalizedOn,
				deliveryState: 'queued',
				failedOn: false,
				lastErrorMessage: false,
				lastErrorDetails: false,
			},
			{ merge: true },
		);
	} catch (error) {
		console.error(
			'Error generating QR Code for uid: ' + newUserAccount.uid,
			serializeError(error),
		);
		await deleteQrCode(newUserAccount.uid).catch(() => undefined);
		await admin.auth().deleteUser(newUserAccount.uid);
		await Promise.all([
			admin
				.firestore()
				.doc(`${COLLECTION_SCHEMA.users}/${newUserAccount.uid}`)
				.delete(),
			admin
				.firestore()
				.doc(`${COLLECTION_SCHEMA.registrations}/${newUserAccount.uid}`)
				.delete(),
			admin
				.firestore()
				.doc(
					`${COLLECTION_SCHEMA.registrationSearchIndex}/${newUserAccount.uid}`,
				)
				.delete(),
			admin
				.firestore()
				.doc(
					`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${newUserAccount.uid}`,
				)
				.delete(),
		]);
		throw new HttpsError(
			'internal',
			'Unable to finalize pre-registration setup',
			serializeError(error),
		);
	}

	return newUserAccount.uid;
}

const createRegistration = async (
	record: Registration,
	uid: string,
): Promise<RegistrationCreationResult> => {
	const emailAddress = record.emailAddress?.toLowerCase();
	const firstName = record.firstName;
	const lastName = record.lastName;
	const zipCode = record.zipCode;
	const requiredFirstName = getRequiredString(firstName, 'first name');
	const requiredLastName = getRequiredString(lastName, 'last name');
	const requiredEmailAddress = getRequiredString(
		emailAddress,
		'email address',
	);

	if (!emailAddress || !firstName || !lastName || !zipCode) {
		throw new HttpsError(
			'invalid-argument',
			'Missing required registration account fields',
		);
	}

	const batch = admin.firestore().batch();

	// Create User Record
	const user: User = {
		firstName: requiredFirstName,
		lastName: requiredLastName,
		emailAddress: requiredEmailAddress,
		zipCode,
		acceptedTermsOfService: new Date(0),
		acceptedPrivacyPolicy: new Date(0),
		version: 1,
		manuallyMigrated: true,
		newsletter: record.newsletter ?? false,
		...(record.referredBy ? { referredBy: record.referredBy } : {}),
	};

	const userDocument = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${uid}`);

	batch.create(userDocument, user);

	// Create Registration Record
	const qrCode = generateId(8);
	const dateTimeSlotSnapshot = await admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.dateTimeSlots}/${record.dateTimeSlot?.id}`)
		.get();
	const rawDateTimeSlotData = dateTimeSlotSnapshot.data();
	const dateTimeSlot = rawDateTimeSlotData?.['dateTime'] as
		| Timestamp
		| undefined;

	if (!dateTimeSlot) {
		throw new HttpsError(
			'not-found',
			`Date/time slot ${record.dateTimeSlot?.id ?? 'unknown'} not found`,
		);
	}

	const registration: Registration = {
		uid,
		firstName: requiredFirstName,
		lastName: requiredLastName,
		emailAddress: requiredEmailAddress,
		zipCode,
		qrcode: qrCode,
		children: record.children,
		dateTimeSlot: {
			id: record.dateTimeSlot?.id,
			dateTime: normalizeDateTime(dateTimeSlot),
		},
		registrationSubmittedOn: new Date(),
		includedInCounts: false,
		includedInRegistrationStats: false,
		programYear: PROGRAM_YEAR,
		qrCodeGeneratedOn: false,
	};

	const registrationDocument = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

	batch.create(registrationDocument, registration);

	// Registration Search Index Record
	const indexDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);

	const indexDoc: RegistrationSearchIndex = {
		code: qrCode,
		customerId: uid,
		firstName: requiredFirstName.toLowerCase(),
		lastName: requiredLastName.toLowerCase(),
		emailAddress: requiredEmailAddress,
		zip: zipCode,
	};

	batch.set(indexDocRef, indexDoc, { merge: true });

	// Create Email Record
	const formattedDateTime = formatRegistrationDateTime(dateTimeSlot);

	await batch.commit();

	return {
		qrCode,
		formattedDateTime,
	};
};

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
