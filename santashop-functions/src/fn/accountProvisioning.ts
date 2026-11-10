import { createHash, randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Registration, User } from '../models';
import admin from '../firebase-admin';
import {
	createQrCodeStoragePath,
	ensureSignupQrCode,
} from '../utility/qrcodes';
import { generateId } from '../utility/id-generation';
import { normalizeDateTime } from '../utility/date-time-format';
import { getErrorCode } from '../utility/errors';
import { PROGRAM_YEAR } from '../utility/runtime-config';

export const SIGNUP_SETUP_MAX_ATTEMPTS = 3;
export const SIGNUP_SETUP_MAX_AGE_MS = 30 * 60_000;
// newAccount has a 60-second invocation limit. A crashed attempt reserves two minutes.
const SETUP_LEASE_MS = 120_000;

interface SignupIntent {
	fingerprint: string;
	user: User;
	registration: Registration;
	startedOn: Date;
	attemptCount: number;
	leaseUntil?: Date | false;
	leaseToken?: string | false;
	completedOn?: Date;
}

export const prepareAccountProvisioning = async (
	mutationId: string,
	profile: Omit<User, 'acceptedTermsOfService' | 'acceptedPrivacyPolicy'>,
): Promise<string> => {
	const uid = `signup_${createHash('sha256').update(mutationId).digest('hex')}`;
	const fingerprint = createHash('sha256')
		.update(JSON.stringify(profile))
		.digest('hex');
	const db = admin.firestore();
	const userRef = db.doc(`users/${uid}`);
	const intentRef = db.doc(`users/${uid}/provisioning/signup`);
	const startedOn = new Date();
	await db.runTransaction(async (transaction) => {
		const [intent, user] = await Promise.all([
			transaction.get(intentRef),
			transaction.get(userRef),
		]);
		if (intent.exists) {
			if (intent.data()!['fingerprint'] !== fingerprint)
				throw new HttpsError(
					'already-exists',
					'This signup request belongs to different account details.',
				);
			return;
		}
		if (user.exists)
			throw new HttpsError(
				'already-exists',
				'Account setup requires support.',
			);
		const userData: User = {
			...profile,
			acceptedTermsOfService: startedOn,
			acceptedPrivacyPolicy: startedOn,
		};
		const registration: Registration = {
			uid,
			firstName: profile.firstName,
			lastName: profile.lastName,
			emailAddress: profile.emailAddress,
			zipCode: profile.zipCode,
			qrcode: generateId(8),
			qrCodeStoragePath: createQrCodeStoragePath(uid),
			programYear: PROGRAM_YEAR,
			qrCodeGeneratedOn: false,
		};
		transaction.create(userRef, userData);
		transaction.create(intentRef, {
			fingerprint,
			user: userData,
			registration,
			startedOn,
			attemptCount: 0,
		} satisfies SignupIntent);
	});
	return uid;
};

export const finalizeAccountProvisioning = async (
	uid: string,
): Promise<void> => {
	const db = admin.firestore();
	const userRef = db.doc(`users/${uid}`);
	const intentRef = db.doc(`users/${uid}/provisioning/signup`);
	const registrationRef = db.doc(`registrations/${uid}`);
	await admin.auth().getUser(uid);
	const token = randomUUID();
	const intent = await db.runTransaction(
		async (transaction): Promise<SignupIntent | undefined> => {
			const [intentSnapshot, user, registration] = await Promise.all([
				transaction.get(intentRef),
				transaction.get(userRef),
				transaction.get(registrationRef),
			]);
			if (!intentSnapshot.exists) {
				if (registration.data()?.['qrCodeGeneratedOn']) return;
				throw new HttpsError(
					'failed-precondition',
					'This older incomplete account needs support. Your account was preserved.',
				);
			}
			const saved = intentSnapshot.data() as SignupIntent;
			if (saved.completedOn) return;
			const now = Date.now();
			if (
				saved.attemptCount >= SIGNUP_SETUP_MAX_ATTEMPTS ||
				now - normalizeDateTime(saved.startedOn).getTime() >=
					SIGNUP_SETUP_MAX_AGE_MS
			)
				throw new HttpsError(
					'failed-precondition',
					'Account setup reached its recovery limit. Contact support. Your account was preserved.',
				);
			if (
				saved.leaseUntil &&
				normalizeDateTime(saved.leaseUntil).getTime() > now
			)
				throw new HttpsError(
					'unavailable',
					'Account setup is still reserved. Retry in two minutes.',
				);
			if (
				registration.exists &&
				(registration.data()!['qrcode'] !== saved.registration.qrcode ||
					registration.data()!['qrCodeStoragePath'] !==
						saved.registration.qrCodeStoragePath)
			)
				throw new HttpsError(
					'failed-precondition',
					'Registration details changed. Contact support to finish setup.',
				);
			if (!user.exists) transaction.create(userRef, saved.user);
			if (!registration.exists) {
				const profile = user.exists
					? (user.data() as User)
					: saved.user;
				transaction.create(registrationRef, {
					...saved.registration,
					firstName: profile.firstName,
					lastName: profile.lastName,
					emailAddress: profile.emailAddress,
					zipCode: profile.zipCode,
				});
			}
			transaction.update(intentRef, {
				attemptCount: saved.attemptCount + 1,
				leaseToken: token,
				leaseUntil: new Date(now + SETUP_LEASE_MS),
			});
			return saved;
		},
	);
	if (!intent) return;
	try {
		await ensureSignupQrCode(
			uid,
			intent.registration.qrCodeStoragePath,
			intent.registration.qrcode!,
		);
		await db.runTransaction(async (transaction) => {
			const [current, registration] = await Promise.all([
				transaction.get(intentRef),
				transaction.get(registrationRef),
			]);
			if (current.data()?.['leaseToken'] !== token)
				throw new HttpsError(
					'aborted',
					'A newer setup attempt owns this account.',
				);
			if (
				!registration.exists ||
				registration.data()!['qrcode'] !== intent.registration.qrcode ||
				registration.data()!['qrCodeStoragePath'] !==
					intent.registration.qrCodeStoragePath
			)
				throw new HttpsError(
					'failed-precondition',
					'Registration changed during setup. Contact support.',
				);
			transaction.update(registrationRef, {
				qrCodeGeneratedOn: new Date(),
				qrCodeGenerationFailedOn: false,
			});
			transaction.update(intentRef, {
				completedOn: new Date(),
				leaseUntil: false,
				leaseToken: false,
			});
		});
	} catch (error) {
		// A failed acknowledgement can follow a successful commit. Read before reporting failure.
		const current = await intentRef.get();
		if (current.data()?.['completedOn']) return;
		await db.runTransaction(async (transaction) => {
			const saved = await transaction.get(intentRef);
			if (saved.data()?.['leaseToken'] === token)
				transaction.update(intentRef, {
					leaseUntil: false,
					leaseToken: false,
					lastFailureCode: getErrorCode(error) ?? 'setup-interrupted',
				});
		});
		throw new HttpsError(
			'unavailable',
			'Account setup is incomplete. Sign in and retry setup. Your account was preserved.',
		);
	}
};
