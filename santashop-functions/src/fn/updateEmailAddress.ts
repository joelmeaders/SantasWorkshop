import { randomUUID } from 'node:crypto';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTION_SCHEMA, type EmailChangeRequest } from '../models';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { requireRecentAuthentication } from '../utility/capabilities';
import {
	requireAuthenticatedUid,
	requireCallableData,
	requireEmailAddress,
	throwMappedAuthHttpsError,
	withCallableValidation,
} from '../utility/callable-validation';
import { requireMutationId } from './registrationMutationSupport';

const log = createFunctionLogger('updateEmailAddress');
// The callable has a 60-second execution limit. A crashed invocation must end
// before another invocation can resume its Auth write.
const LEASE_MS = 120_000;

interface EmailChangeIntent {
	mutationId: string;
	emailAddress: string;
	previousEmailAddress: string;
	status: 'pending' | 'complete' | 'failed';
	attemptId: string;
	leaseExpiresAt: number;
}

export default async function updateEmailAddress(
	request: CallableRequest<EmailChangeRequest>,
): Promise<true> {
	const uid = requireAuthenticatedUid(request);
	requireRecentAuthentication(request.auth!.token);
	const data = withCallableValidation(() => {
		const record = requireCallableData(request.data);
		return {
			mutationId: requireMutationId(record['mutationId']),
			emailAddress: requireEmailAddress(record['emailAddress']),
			expectedEmailAddress: requireEmailAddress(
				record['expectedEmailAddress'],
			),
		};
	});
	const db = admin.firestore();
	const auth = admin.auth();
	const userRef = db.doc(COLLECTION_SCHEMA.users + '/' + uid);
	const stateRef = userRef.collection('emailChanges').doc('state');
	const receiptRef = userRef.collection('emailChanges').doc(data.mutationId);
	const attemptId = randomUUID();
	const currentEmail = (await auth.getUser(uid)).email?.toLowerCase();
	const recoveryDetails = (
		intent: Pick<EmailChangeIntent, 'mutationId' | 'emailAddress'>,
		emailAddress: string | undefined,
	): Record<string, unknown> => ({
		reason: 'email-change-incomplete',
		mutationId: intent.mutationId,
		targetEmailAddress: intent.emailAddress,
		emailAddress: emailAddress ?? null,
	});
	const intent = await db.runTransaction(async (transaction) => {
		const [state, receipt] = await Promise.all([
			transaction.get(stateRef),
			transaction.get(receiptRef),
		]);
		const active = state.data() as EmailChangeIntent | undefined;
		const previous = receipt.data() as EmailChangeIntent | undefined;
		if (
			(previous && active?.mutationId !== data.mutationId) ||
			(!previous &&
				active?.status === 'complete' &&
				active.emailAddress !== data.expectedEmailAddress)
		) {
			throw new HttpsError(
				'aborted',
				'A newer email change replaced this request.',
			);
		}
		if (previous && previous.emailAddress !== data.emailAddress) {
			throw new HttpsError(
				'invalid-argument',
				'This operation ID belongs to a different email change.',
			);
		}
		if (previous?.status === 'complete') {
			if (
				active?.mutationId !== data.mutationId ||
				currentEmail !== data.emailAddress
			) {
				throw new HttpsError(
					'aborted',
					'A newer email change replaced this request. Refresh your account before trying again.',
				);
			}
			return undefined;
		}
		if (
			active?.status === 'pending' &&
			(active.mutationId !== data.mutationId ||
				active.leaseExpiresAt > Date.now())
		) {
			throw new HttpsError(
				'aborted',
				'An email change is unfinished. Retry the same address after two minutes.',
				recoveryDetails(active, currentEmail),
			);
		}
		if (!previous && currentEmail !== data.expectedEmailAddress) {
			throw new HttpsError(
				'aborted',
				'Your sign-in email changed. Refresh your account before trying again.',
			);
		}
		const intent: EmailChangeIntent = {
			mutationId: data.mutationId,
			emailAddress: data.emailAddress,
			previousEmailAddress:
				previous?.previousEmailAddress ?? data.expectedEmailAddress,
			status: 'pending',
			attemptId,
			leaseExpiresAt: Date.now() + LEASE_MS,
		};
		transaction.set(stateRef, intent);
		transaction.set(receiptRef, intent);
		return intent;
	});
	if (!intent) return true;

	try {
		const active = await stateRef.get();
		if (
			active.data()?.['attemptId'] !== attemptId ||
			intent.leaseExpiresAt <= Date.now()
		) {
			throw new HttpsError(
				'aborted',
				'This email change must be retried before continuing.',
			);
		}
		const actual = (await auth.getUser(uid)).email?.toLowerCase();
		if (actual !== data.emailAddress) {
			if (actual !== intent.previousEmailAddress)
				throw new HttpsError(
					'aborted',
					'Your sign-in email changed during this request.',
				);
			await auth.updateUser(uid, { email: data.emailAddress });
		}
		const registrationRef = db.doc(
			COLLECTION_SCHEMA.registrations + '/' + uid,
		);
		const indexRef = db.doc(
			COLLECTION_SCHEMA.registrationSearchIndex + '/' + uid,
		);
		const [state, registration, index] = await db.getAll(
			stateRef,
			registrationRef,
			indexRef,
		);
		if (state.data()?.['attemptId'] !== attemptId)
			throw new HttpsError(
				'aborted',
				'A newer email change replaced this request.',
			);
		const batch = db.batch();
		const emailData = { emailAddress: data.emailAddress };
		batch.set(userRef, emailData, { merge: true });
		if (registration.exists) batch.update(registrationRef, emailData);
		if (index.exists) batch.update(indexRef, emailData);
		batch.update(
			stateRef,
			{ status: 'complete', leaseExpiresAt: 0 },
			{ lastUpdateTime: state.updateTime! },
		);
		batch.update(receiptRef, { status: 'complete', leaseExpiresAt: 0 });
		await batch.commit();
		return true;
	} catch (error) {
		log.error(
			'Email change requires state verification',
			{ uid, mutationId: data.mutationId },
			error,
		);
		let actualEmail: string | undefined;
		try {
			const [identity, receipt] = await Promise.all([
				auth.getUser(uid),
				receiptRef.get(),
			]);
			actualEmail = identity.email?.toLowerCase();
			if (
				receipt.data()?.['status'] === 'complete' &&
				actualEmail === data.emailAddress
			)
				return true;
			await db.runTransaction(async (transaction) => {
				const state = await transaction.get(stateRef);
				if (state.data()?.['attemptId'] !== attemptId) return;
				const rejected =
					actualEmail === data.expectedEmailAddress &&
					typeof error === 'object' &&
					error !== null &&
					'code' in error &&
					[
						'auth/email-already-exists',
						'auth/invalid-email',
					].includes(String(error.code));
				transaction.update(stateRef, {
					leaseExpiresAt: 0,
					...(rejected ? { status: 'failed' } : {}),
				});
			});
		} catch (verificationError) {
			log.error(
				'Unable to verify email change outcome',
				{ uid },
				verificationError,
			);
		}
		if (actualEmail === data.expectedEmailAddress)
			throwMappedAuthHttpsError(
				error,
				'Email change is unfinished. Retry the same address.',
			);
		throw new HttpsError(
			'unavailable',
			actualEmail
				? 'Your sign-in email is ' +
						actualEmail +
						'. Save the same email again to finish updating your records.'
				: 'Your email change could not be verified. Retry the same address after two minutes.',
			recoveryDetails(data, actualEmail),
		);
	}
}
