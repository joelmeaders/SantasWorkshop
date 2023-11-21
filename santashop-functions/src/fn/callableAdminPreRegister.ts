/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { CallableContext, HttpsError } from 'firebase-functions/v1/https';
import {
	User,
	Registration,
	COLLECTION_SCHEMA,
	RegistrationSearchIndex,
} from '../../../santashop-models/src';
import { generateId } from '../utility/id-generation';
import { generateQrCode } from '../utility/qrcodes';
import * as formatDateTime from 'dateformat';

admin.initializeApp();

export default async (record: Registration, context: CallableContext): Promise<string | HttpsError> => {

	if (!context.auth?.token?.admin) {
		console.error(
			`${context.auth?.uid} attempted to create registration for ${record.emailAddress}`,
		);
		throw new functions.https.HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}

	// Create Account
	const newUserAccount = await admin.auth()
		.createUser({
			email: record.emailAddress!.toLowerCase(),
			password: generateId(12),
			disabled: false,
			displayName: `${record.firstName} ${record.lastName}`,
		})
		.catch((error) => {
			console.error(
				`${record.emailAddress}`,
				new Error(JSON.stringify(error)),
			);
			throw handleAuthError(error);
		});

	let qrCode: string;

	try {
		qrCode = await createRegistration(record, newUserAccount.uid);
	}
	catch (error: any) {
		await admin.auth().deleteUser(newUserAccount.uid);
		throw new functions.https.HttpsError(
			error.code ?? 'cancelled',
			error.message ?? 'Failed to create registration after account creation'
		);
	}

	try {
		await generateQrCode(newUserAccount.uid, qrCode);
	}
	catch (error) {
		console.error(
			'Error generating QR Code for uid: ' + newUserAccount.uid,
			JSON.stringify(error),
		);
	}
	
	return newUserAccount.uid
};

const createRegistration = async (record: Registration, uid: string): Promise<string> => {
	const batch = admin.firestore().batch();

	// Create User Record
	const user: User = {
		firstName: record.firstName!,
		lastName: record.lastName!,
		emailAddress: record.emailAddress!.toLowerCase(),
		zipCode: record.zipCode!,
		acceptedTermsOfService: new Date(0),
		acceptedPrivacyPolicy: new Date(0),
		version: 1,
		manuallyMigrated: true,
		newsletter: record.newsletter ?? false,
		referredBy: record.referredBy,
	};

	const userDocument = admin.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${uid}`);

	batch.create(userDocument, user);

	// Create Registration Record
	const qrCode = generateId(8);
	const dateTimeSlot = await admin.firestore()
		.doc(`${COLLECTION_SCHEMA.dateTimeSlots}/${record.dateTimeSlot?.id}`)
		.get().then((doc) => {
			return doc.data()!.dateTime as any;
		});

	const registration: Registration = {
		uid,
		firstName: record.firstName,
		lastName: record.lastName,
		emailAddress: record.emailAddress!.toLowerCase(),
		zipCode: record.zipCode,
		qrcode: qrCode,
		children: record.children,
		dateTimeSlot: {
			id: record.dateTimeSlot?.id,
			dateTime: dateTimeSlot,
		},
		registrationSubmittedOn: new Date(),
		includedInCounts: false,
		includedInRegistrationStats: false,
		programYear: 2023,
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
		firstName: record.firstName!.toLowerCase(),
		lastName: record.lastName!.toLowerCase(),
		emailAddress: record.emailAddress!.toLowerCase(),
		zip: record.zipCode!,
	};

	batch.set(indexDocRef, indexDoc, { merge: true });

	// Create Email Record
	const emailDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);

	let dateTime: string;

	dateTime = record.dateTimeSlot?.dateTime as any as string;
	const tmp = new Date(dateTime);
	const dateZ = tmp.toLocaleString('en-US', { timeZone: 'MST' });
	dateTime = formatDateTime.default(dateZ, 'dddd, mmmm d, h:MM TT');

	const emailDoc = {
		code: qrCode,
		email: record.emailAddress,
		name: record.firstName,
		formattedDateTime: dateTime,
	};

	batch.set(emailDocRef, emailDoc, { merge: true });

	await batch.commit();

	return qrCode;
}

const handleAuthError = (error: any) => {
	switch (error.code) {
		case 'auth/email-already-exists':
			throw new functions.https.HttpsError(
				'already-exists',
				error.code,
				error.message,
			);
		default:
			throw new functions.https.HttpsError(
				'unknown',
				error.code,
				error.message,
			);
	}
};
