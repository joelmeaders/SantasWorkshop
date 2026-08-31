import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { COLLECTION_SCHEMA, type PublicParameters, type Registration } from '../models';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import {
	MUTATION_RECEIPTS_SUBCOLLECTION,
	getStoredMutationResult,
	requireDraftRegistration,
	requireMutationId,
	requireObject,
	requireOnlyKeys,
	requireOpenPreRegistration,
	type MutationReceipt,
} from './registrationMutationSupport';

interface DeleteDraftChildData {
	mutationId: string;
	childId: number;
}

const requireChildId = (value: unknown): number => {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new HttpsError('invalid-argument', 'Child ID must be a non-negative integer.');
	}
	return value as number;
};

export default async function deleteDraftChild(
	request: CallableRequest<DeleteDraftChildData>,
): Promise<true> {
	const uid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId', 'childId']);
	const mutationId = requireMutationId(data['mutationId']);
	const childId = requireChildId(data['childId']);
	const db = admin.firestore();
	const registrationRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const parametersRef = db.doc(`${COLLECTION_SCHEMA.parameters}/public`);
	const receiptRef = registrationRef.collection(MUTATION_RECEIPTS_SUBCOLLECTION).doc(mutationId);

	await db.runTransaction(async (transaction) => {
		const [registrationSnapshot, parametersSnapshot, receiptSnapshot] = await Promise.all([
			transaction.get(registrationRef),
			transaction.get(parametersRef),
			transaction.get(receiptRef),
		]);
		const cached = getStoredMutationResult(
			receiptSnapshot.exists ? receiptSnapshot.data() as MutationReceipt : undefined,
			'deleteDraftChild',
		);
		if (cached) return;
		requireOpenPreRegistration(parametersSnapshot.data() as PublicParameters | undefined);
		const registration = requireDraftRegistration(registrationSnapshot.data() as Registration | undefined);
		const children = registration.children ?? [];
		if (!children.some((child) => child.id === childId)) {
			throw new HttpsError('not-found', 'Child was not found in this registration.');
		}

		transaction.set(registrationRef, { children: children.filter((child) => child.id !== childId) }, { merge: true });
		transaction.create(receiptRef, { operation: 'deleteDraftChild', result: true, completedOn: new Date() } satisfies MutationReceipt);
	});

	return true;
}
