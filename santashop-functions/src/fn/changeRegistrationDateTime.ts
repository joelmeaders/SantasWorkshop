import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_KEYS,
	type DateTimeSlot,
	type PublicParameters,
	type Registration,
} from '../models';
import { isAdminToken } from '../utility/capabilities';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import { formatRegistrationDateTime } from '../utility/date-time-format';
import { createFunctionLogger } from '../utility/observability';
import {
	MUTATION_RECEIPTS_SUBCOLLECTION,
	getStoredMutationResult,
	requireEnabledCurrentSlot,
	requireMutationId,
	requireObject,
	requireOnlyKeys,
	type MutationReceipt,
} from './registrationMutationSupport';

const log = createFunctionLogger('changeRegistrationDateTime');

interface ChangeRegistrationData {
	mutationId: string;
	slotId: string;
	registrationUid?: string;
}

const requireSlotId = (value: unknown): string => {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
		throw new HttpsError('invalid-argument', 'Slot ID is invalid.');
	}
	return value;
};

const requireRegistrationUid = (value: unknown): string | undefined => {
	if (value === undefined) return undefined;
	if (typeof value !== 'string' || !value.trim()) {
		throw new HttpsError('invalid-argument', 'Registration UID is invalid.');
	}
	return value;
};

export default async function changeRegistrationDateTime(
	request: CallableRequest<ChangeRegistrationData>,
): Promise<true> {
	const actorUid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId', 'slotId', 'registrationUid']);
	const mutationId = requireMutationId(data['mutationId']);
	const requestedUid = requireRegistrationUid(data['registrationUid']);
	const isAdmin = isAdminToken(request.auth?.token);
	if (requestedUid && !isAdmin) {
		throw new HttpsError(
			'permission-denied',
			'Only staff can change another registration.',
		);
	}
	const uid = requestedUid ?? actorUid;
	const slotId = requireSlotId(data['slotId']);
	const db = admin.firestore();
	const registrationRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const parametersRef = db.doc(`${COLLECTION_SCHEMA.parameters}/public`);
	const slotRef = db.doc(`${COLLECTION_SCHEMA.dateTimeSlots}/${slotId}`);
	const receiptRef = registrationRef.collection(MUTATION_RECEIPTS_SUBCOLLECTION).doc(mutationId);

	try {
		await db.runTransaction(async (transaction) => {
			const [registrationSnapshot, parametersSnapshot, slotSnapshot, receiptSnapshot] = await Promise.all([
				transaction.get(registrationRef),
				transaction.get(parametersRef),
				transaction.get(slotRef),
				transaction.get(receiptRef),
			]);
			const cached = getStoredMutationResult(
				receiptSnapshot.exists ? receiptSnapshot.data() as MutationReceipt : undefined,
				'changeRegistrationDateTime',
			);
			if (cached) return;
			const registration = registrationSnapshot.data() as Registration | undefined;
			if (!registration) {
				throw new HttpsError('not-found', `Registration not found for ${uid}.`);
			}
			if (!registration.registrationSubmittedOn) {
				throw new HttpsError('failed-precondition', 'Registration is not submitted.');
			}
			if (registration.hasCheckedIn) {
				throw new HttpsError('failed-precondition', 'Cannot change registration after check-in.');
			}

			const parameters = parametersSnapshot.data() as PublicParameters | undefined;
			if (!parameters?.admin?.allowChangeRegistration) {
				throw new HttpsError('failed-precondition', 'Registration changes are currently unavailable.');
			}

			// The requested slot already being stored is an equivalent retry/no-op.
			if (registration.dateTimeSlot?.id === slotId) {
				transaction.create(receiptRef, {
					operation: 'changeRegistrationDateTime',
					result: true,
					completedOn: new Date(),
				} satisfies MutationReceipt);
				return;
			}

			const slot = requireEnabledCurrentSlot(
				slotSnapshot.data() as DateTimeSlot | undefined,
				slotId,
			);
			const queuedOn = new Date();
			const emailRecord = {
				code: registration.qrcode,
				email: registration.emailAddress,
				name: registration.firstName,
				formattedDateTime: formatRegistrationDateTime(slot.dateTime),
				templateKey: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
				queuedOn,
				queueSource: 'date-time-change',
				deliveryRequestedOn: queuedOn,
				deliveryState: 'queued',
				failedOn: false,
				lastErrorMessage: false,
				lastErrorDetails: false,
			};
			const emailRef = db.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);
			const registrationUpdate = {
				previousDateTimeSlot: registration.dateTimeSlot,
				dateTimeSlot: { id: slot.id, dateTime: slot.dateTime },
				includedInCounts: false,
				reminderEmailSentOn: false,
				reminderEmailFailedOn: false,
			};

			// Capacity remains eventually consistent: this never updates a slot counter.
			transaction.set(registrationRef, registrationUpdate, { merge: true });
			transaction.set(emailRef, emailRecord, { merge: true });
			transaction.create(receiptRef, {
				operation: 'changeRegistrationDateTime',
				result: true,
				completedOn: queuedOn,
			} satisfies MutationReceipt);
		});
		return true;
	} catch (error) {
		if (error instanceof HttpsError) throw error;
		log.error('Failed to change registration date/time slot', { uid, actorUid, slotId }, error);
		throw new HttpsError('internal', 'Unable to change registration appointment.');
	}
}
