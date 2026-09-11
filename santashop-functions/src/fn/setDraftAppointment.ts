import { getBookingNow } from '../utility/booking-clock';
import { getPublicParameters } from '../utility/public-parameters';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	type DateTimeSlot,
	type Registration,
} from '../models';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import {
	MUTATION_RECEIPTS_SUBCOLLECTION,
	getStoredMutationResult,
	requireCanonicalChildren,
	requireDraftRegistration,
	requireEnabledCurrentSlot,
	requireReviewedAppointment,
	requireMutationId,
	requireObject,
	requireOnlyKeys,
	requireOpenPreRegistration,
	type MutationReceipt,
} from './registrationMutationSupport';

interface SetDraftAppointmentData {
	mutationId: string;
	slotId: string;
	reviewedDateTime?: string;
}

const requireSlotId = (value: unknown): string => {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
		throw new HttpsError('invalid-argument', 'Slot ID is invalid.');
	}
	return value;
};

export default async function setDraftAppointment(
	request: CallableRequest<SetDraftAppointmentData>,
): Promise<true> {
	const uid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId', 'slotId', 'reviewedDateTime']);
	const mutationId = requireMutationId(data['mutationId']);
	const slotId = requireSlotId(data['slotId']);
	const db = admin.firestore();
	const registrationRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const slotRef = db.doc(`${COLLECTION_SCHEMA.dateTimeSlots}/${slotId}`);
	const receiptRef = registrationRef
		.collection(MUTATION_RECEIPTS_SUBCOLLECTION)
		.doc(mutationId);

	await db.runTransaction(async (transaction) => {
		const [registrationSnapshot, slotSnapshot, receiptSnapshot] =
			await Promise.all([
				transaction.get(registrationRef),
				transaction.get(slotRef),
				transaction.get(receiptRef),
			]);
		const cached = getStoredMutationResult(
			receiptSnapshot.exists
				? (receiptSnapshot.data() as MutationReceipt)
				: undefined,
			'setDraftAppointment',
		);
		if (cached) return;
		const parameters = await getPublicParameters();
		const now = await getBookingNow(db);
		requireOpenPreRegistration(parameters);
		const registration = requireDraftRegistration(
			registrationSnapshot.data() as Registration | undefined,
		);
		requireCanonicalChildren(registration.children);
		const slot = requireEnabledCurrentSlot(
			slotSnapshot.data() as DateTimeSlot | undefined,
			slotId,
			now,
		);

		if (data['reviewedDateTime'] !== undefined)
			requireReviewedAppointment(data['reviewedDateTime'], slot.dateTime);
		transaction.set(
			registrationRef,
			{ dateTimeSlot: { id: slot.id, dateTime: slot.dateTime } },
			{ merge: true },
		);
		transaction.create(receiptRef, {
			operation: 'setDraftAppointment',
			result: true,
			completedOn: new Date(),
		} satisfies MutationReceipt);
	});

	return true;
}
