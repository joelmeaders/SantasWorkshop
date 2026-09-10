import admin from '../firebase-admin';
import { COLLECTION_SCHEMA, type Child, type Registration } from '../models';
import { getPublicParameters } from '../utility/public-parameters';
import {
	MUTATION_RECEIPTS_SUBCOLLECTION,
	getStoredMutationResult,
	requireDraftRegistration,
	requireOpenPreRegistration,
	type MutationReceipt,
} from './registrationMutationSupport';

/** The callback must be pure: Firestore can retry it before committing. */
export async function mutateDraftChildren(
	uid: string,
	mutationId: string,
	operation: 'saveDraftChild' | 'deleteDraftChild',
	updateChildren: (children: Child[]) => Child[],
): Promise<true> {
	const db = admin.firestore();
	const registrationRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const parameters = await getPublicParameters();
	const receiptRef = registrationRef
		.collection(MUTATION_RECEIPTS_SUBCOLLECTION)
		.doc(mutationId);
	await db.runTransaction(async (transaction) => {
		const [registrationSnapshot, receiptSnapshot] = await Promise.all([
			transaction.get(registrationRef),
			transaction.get(receiptRef),
		]);
		// A completed request stays replayable after flags or registration state change.
		if (
			getStoredMutationResult(
				receiptSnapshot.exists
					? (receiptSnapshot.data() as MutationReceipt)
					: undefined,
				operation,
			)
		)
			return;
		requireOpenPreRegistration(parameters);
		const registration = requireDraftRegistration(
			registrationSnapshot.data() as Registration | undefined,
		);
		transaction.set(
			registrationRef,
			{ children: updateChildren([...(registration.children ?? [])]) },
			{ merge: true },
		);
		transaction.create(receiptRef, {
			operation,
			result: true,
			completedOn: new Date(),
		} satisfies MutationReceipt);
	});
	return true;
}
