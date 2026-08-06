import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_KEYS,
	type DateTimeSlot,
	type PublicParameters,
	type Registration,
	type RegistrationSearchIndex,
	type User,
} from '../models';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import { formatRegistrationDateTime } from '../utility/date-time-format';
import { createFunctionLogger } from '../utility/observability';
import { PROGRAM_YEAR } from '../utility/runtime-config';
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

const log = createFunctionLogger('completeRegistration');

interface CompleteRegistrationData {
	mutationId: string;
}

export default async function completeRegistration(
	request: CallableRequest<CompleteRegistrationData>,
): Promise<true> {
	const uid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId']);
	const mutationId = requireMutationId(data['mutationId']);
	const db = admin.firestore();
	const registrationRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const userRef = db.doc(`${COLLECTION_SCHEMA.users}/${uid}`);
	const parametersRef = db.doc(`${COLLECTION_SCHEMA.parameters}/public`);
	const receiptRef = registrationRef.collection(MUTATION_RECEIPTS_SUBCOLLECTION).doc(mutationId);

	try {
		await db.runTransaction(async (transaction) => {
			const [registrationSnapshot, userSnapshot, parametersSnapshot, receiptSnapshot] = await Promise.all([
				transaction.get(registrationRef),
				transaction.get(userRef),
				transaction.get(parametersRef),
				transaction.get(receiptRef),
			]);
			const cached = getStoredMutationResult(
				receiptSnapshot.exists ? receiptSnapshot.data() as MutationReceipt : undefined,
				'completeRegistration',
			);
			if (cached) return;
			const registrationData = registrationSnapshot.data() as Registration | undefined;
			if (registrationData?.registrationSubmittedOn) {
				transaction.create(receiptRef, {
					operation: 'completeRegistration',
					result: true,
					completedOn: new Date(),
				} satisfies MutationReceipt);
				return;
			}
			requireOpenPreRegistration(parametersSnapshot.data() as PublicParameters | undefined);
			const registration = requireDraftRegistration(registrationData);
			const user = userSnapshot.data() as User | undefined;
			if (!user?.firstName || !user.lastName || !user.emailAddress || user.zipCode === undefined) {
				throw new HttpsError('failed-precondition', 'Account information is incomplete.');
			}
			const children = requireCanonicalChildren(registration.children);
			const slotId = registration.dateTimeSlot?.id;
			if (!slotId || typeof slotId !== 'string') {
				throw new HttpsError('failed-precondition', 'An appointment is required.');
			}
			const slotRef = db.doc(`${COLLECTION_SCHEMA.dateTimeSlots}/${slotId}`);
			const slotSnapshot = await transaction.get(slotRef);
			const slot = requireEnabledCurrentSlot(slotSnapshot.data() as DateTimeSlot | undefined, slotId);
			if (!registration.qrcode) {
				throw new HttpsError('failed-precondition', 'Registration confirmation code is unavailable.');
			}

			const submittedOn = new Date();
			const canonicalContact = {
				firstName: user.firstName,
				lastName: user.lastName,
				emailAddress: user.emailAddress.toLowerCase(),
				zipCode: user.zipCode,
			};
			const registrationUpdate = {
				...canonicalContact,
				children,
				dateTimeSlot: { id: slot.id, dateTime: slot.dateTime },
				registrationSubmittedOn: submittedOn,
				includedInCounts: false,
				includedInRegistrationStats: false,
				programYear: PROGRAM_YEAR,
			};
			const emailRef = db.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);
			const indexRef = db.doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);
			const emailRecord = {
				code: registration.qrcode,
				email: canonicalContact.emailAddress,
				name: canonicalContact.firstName,
				formattedDateTime: formatRegistrationDateTime(slot.dateTime),
				templateKey: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
			};
			const indexRecord: RegistrationSearchIndex = {
				code: registration.qrcode,
				customerId: uid,
				firstName: canonicalContact.firstName.toLowerCase(),
				lastName: canonicalContact.lastName.toLowerCase(),
				displayFirstName: canonicalContact.firstName,
				displayLastName: canonicalContact.lastName,
				emailAddress: canonicalContact.emailAddress,
				zip: canonicalContact.zipCode,
			};

			// This transaction deliberately never writes the shared slot document.
			// scheduledDateTimeSlotCounters2 reconciles capacity after submissions.
			transaction.set(registrationRef, registrationUpdate, { merge: true });
			transaction.set(emailRef, emailRecord, { merge: true });
			transaction.set(indexRef, indexRecord, { merge: true });
			transaction.create(receiptRef, { operation: 'completeRegistration', result: true, completedOn: submittedOn } satisfies MutationReceipt);
		});
		return true;
	} catch (error) {
		if (error instanceof HttpsError) throw error;
		log.error('Failed to complete registration', { uid }, error);
		throw new HttpsError('internal', 'Unable to complete registration.');
	}
}
