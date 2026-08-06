import { type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { COLLECTION_SCHEMA, type PublicParameters, type Registration } from '../models';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import {
	MUTATION_RECEIPTS_SUBCOLLECTION,
	canonicalizeChild,
	getStoredMutationResult,
	requireDraftRegistration,
	requireMutationId,
	requireObject,
	requireOnlyKeys,
	requireOpenPreRegistration,
	type MutationReceipt,
} from './registrationMutationSupport';

interface SaveDraftChildData {
	mutationId: string;
	child: unknown;
}

export default async function saveDraftChild(
	request: CallableRequest<SaveDraftChildData>,
): Promise<true> {
	const uid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId', 'child']);
	const mutationId = requireMutationId(data['mutationId']);
	const child = canonicalizeChild(data['child']);
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
			'saveDraftChild',
		);
		if (cached) return;
		requireOpenPreRegistration(parametersSnapshot.data() as PublicParameters | undefined);
		const registration = requireDraftRegistration(registrationSnapshot.data() as Registration | undefined);
		const children = [...(registration.children ?? [])];
		const existingIndex = children.findIndex((candidate) => candidate.id === child.id);
		if (existingIndex >= 0) children[existingIndex] = child;
		else children.push(child);

		transaction.set(registrationRef, { children }, { merge: true });
		transaction.create(receiptRef, { operation: 'saveDraftChild', result: true, completedOn: new Date() } satisfies MutationReceipt);
	});

	return true;
}
