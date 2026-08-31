import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { COLLECTION_SCHEMA, type DateTimeSlot, type PublicParameters, type Registration } from '../models';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import {
	MUTATION_RECEIPTS_SUBCOLLECTION,
	getStoredMutationResult,
	requireCanonicalChildren,
	requireDraftRegistration,
	requireEnabledCurrentSlot,
	requireMutationId,
	requireObject,
	requireOnlyKeys,
	requireOpenPreRegistration,
	type MutationReceipt,
} from './registrationMutationSupport';

interface SetDraftAppointmentData {
	mutationId: string;
	slotId: string;
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
	requireOnlyKeys(data, ['mutationId', 'slotId']);
	const mutationId = requireMutationId(data['mutationId']);
	const slotId = requireSlotId(data['slotId']);
	const db = admin.firestore();
	const registrationRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const parametersRef = db.doc(`${COLLECTION_SCHEMA.parameters}/public`);
	const slotRef = db.doc(`${COLLECTION_SCHEMA.dateTimeSlots}/${slotId}`);
	const receiptRef = registrationRef.collection(MUTATION_RECEIPTS_SUBCOLLECTION).doc(mutationId);

	await db.runTransaction(async (transaction) => {
		const [registrationSnapshot, parametersSnapshot, slotSnapshot, receiptSnapshot] = await Promise.all([
			transaction.get(registrationRef),
			transaction.get(parametersRef),
			transaction.get(slotRef),
			transaction.get(receiptRef),
		]);
		const cached = getStoredMutationResult(
			receiptSnapshot.exists ? receiptSnapshot.data() as MutationReceipt : undefined,
			'setDraftAppointment',
		);
		if (cached) return;
		requireOpenPreRegistration(parametersSnapshot.data() as PublicParameters | undefined);
		const registration = requireDraftRegistration(registrationSnapshot.data() as Registration | undefined);
		requireCanonicalChildren(registration.children);
		const slot = requireEnabledCurrentSlot(slotSnapshot.data() as DateTimeSlot | undefined, slotId);

		transaction.set(registrationRef, { dateTimeSlot: { id: slot.id, dateTime: slot.dateTime } }, { merge: true });
		transaction.create(receiptRef, { operation: 'setDraftAppointment', result: true, completedOn: new Date() } satisfies MutationReceipt);
	});

	return true;
}
