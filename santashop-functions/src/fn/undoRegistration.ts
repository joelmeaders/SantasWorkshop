import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	type DateTimeSlot,
	type PublicParameters,
	type Registration,
	type RegistrationCancellation,
} from '../models';
import { isAdminToken } from '../utility/capabilities';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import { formatRegistrationDateTime, type DateTimeValue } from '../utility/date-time-format';
import { generateId } from '../utility/id-generation';
import { createFunctionLogger } from '../utility/observability';
import {
	createQrCodeStoragePath,
	generateQrCode,
	replaceQrCodeWithCancelled,
} from '../utility/qrcodes';
import { PROGRAM_YEAR } from '../utility/runtime-config';
import {
	MUTATION_RECEIPTS_SUBCOLLECTION,
	getStoredMutationResult,
	requireMutationId,
	requireObject,
	requireOnlyKeys,
	type MutationReceipt,
} from './registrationMutationSupport';

const log = createFunctionLogger('undoRegistration');

interface UndoRegistrationRequest {
	mutationId: string;
	uid?: string;
}

interface CancellationResult {
	uid: string;
	newConfirmationCode: string;
	previousDateTimeSlot?: Partial<DateTimeSlot>;
	emailAddress?: string;
	firstName?: string;
	supersededQrCodeStoragePath: string;
	replacementQrCodeStoragePath: string;
}

const requireRegistrationUid = (value: unknown): string | undefined => {
	if (value === undefined) return undefined;
	if (typeof value !== 'string' || !value.trim()) {
		throw new HttpsError('invalid-argument', 'Registration UID is invalid.');
	}
	return value;
};

const resultFromCancellation = (
	uid: string,
	registration: Registration,
	cancellation: RegistrationCancellation,
): CancellationResult => ({
	uid,
	newConfirmationCode: registration.qrcode ?? '',
	previousDateTimeSlot: registration.previousDateTimeSlot,
	emailAddress: registration.emailAddress,
	firstName: registration.firstName,
	supersededQrCodeStoragePath: cancellation.supersededQrCodeStoragePath,
	replacementQrCodeStoragePath: cancellation.replacementQrCodeStoragePath,
});

const queueCancellationEmail = async (result: CancellationResult): Promise<void> => {
	if (!result.newConfirmationCode || !result.emailAddress || !result.firstName) return;

	const queuedOn = new Date();
	await admin.firestore().doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${result.uid}`).set({
		code: result.newConfirmationCode,
		email: result.emailAddress,
		name: result.firstName,
		formattedDateTime: result.previousDateTimeSlot?.dateTime
			? formatRegistrationDateTime(result.previousDateTimeSlot.dateTime as DateTimeValue)
			: 'your previous appointment',
		queuedOn,
		queueSource: 'registration-cancellation',
		deliveryRequestedOn: queuedOn,
		deliveryState: 'queued',
		failedOn: false,
		lastErrorMessage: false,
		lastErrorDetails: false,
	});
};

const finalizeCancellation = async (
	registrationRef: ReturnType<ReturnType<typeof admin.firestore>['doc']>,
	result: CancellationResult,
): Promise<void> => {
	if (!result.newConfirmationCode) {
		throw new HttpsError('failed-precondition', 'Registration confirmation code is unavailable.');
	}
	await replaceQrCodeWithCancelled(result.supersededQrCodeStoragePath);
	await generateQrCode(
		result.replacementQrCodeStoragePath,
		result.newConfirmationCode,
	);
	await registrationRef.set(
		{ qrCodeGeneratedOn: new Date(), qrCodeGenerationFailedOn: false },
		{ merge: true },
	);
	await queueCancellationEmail(result);
};

export default async function undoRegistration(
	request: CallableRequest<UndoRegistrationRequest>,
): Promise<true> {
	const actorUid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId', 'uid']);
	const mutationId = requireMutationId(data['mutationId']);
	const requestedUid = requireRegistrationUid(data['uid']);
	const isAdmin = isAdminToken(request.auth?.token);
	if (requestedUid && !isAdmin) {
		throw new HttpsError('permission-denied', 'Only staff can cancel another registration.');
	}
	const uid = requestedUid ?? actorUid;
	const db = admin.firestore();
	const registrationRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const indexRef = db.doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);
	const emailRef = db.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);
	const parametersRef = db.doc(`${COLLECTION_SCHEMA.parameters}/public`);
	const receiptRef = registrationRef.collection(MUTATION_RECEIPTS_SUBCOLLECTION).doc(mutationId);
	let result: CancellationResult | undefined;

	try {
		await db.runTransaction(async (transaction) => {
			const [registrationSnapshot, parametersSnapshot, receiptSnapshot] = await Promise.all([
				transaction.get(registrationRef),
				transaction.get(parametersRef),
				transaction.get(receiptRef),
			]);
			const cached = getStoredMutationResult(
				receiptSnapshot.exists ? receiptSnapshot.data() as MutationReceipt : undefined,
				'undoRegistration',
			);
			const registration = registrationSnapshot.data() as Registration | undefined;
			if (!registration) {
				throw new HttpsError('not-found', `Registration not found for ${uid}.`);
			}
			if (cached || registration.cancelledOn) {
				if (!registration.cancellationLogId) {
					throw new HttpsError('internal', 'Cancellation record is unavailable.');
				}
				const cancellationSnapshot = await transaction.get(
					db.doc(`${COLLECTION_SCHEMA.cancellations}/${registration.cancellationLogId}`),
				);
				const cancellation = cancellationSnapshot.data() as
					| RegistrationCancellation
					| undefined;
				if (!cancellation) {
					throw new HttpsError('internal', 'Cancellation record is unavailable.');
				}
				if (!cached) {
					transaction.create(receiptRef, {
						operation: 'undoRegistration',
						result: true,
						completedOn: new Date(),
					} satisfies MutationReceipt);
				}
				result = resultFromCancellation(uid, registration, cancellation);
				return;
			}

			const parameters = parametersSnapshot.data() as PublicParameters | undefined;
			if (!parameters?.admin?.allowCancelRegistration) {
				throw new HttpsError('failed-precondition', 'Registration cancellation is currently unavailable.');
			}
			if (!registration.registrationSubmittedOn) {
				throw new HttpsError('failed-precondition', 'Only submitted registrations can be cancelled.');
			}
			if (registration.hasCheckedIn) {
				throw new HttpsError('failed-precondition', 'Checked-in registrations cannot be cancelled.');
			}
			if (!registration.qrcode || !registration.qrCodeStoragePath) {
				throw new HttpsError('failed-precondition', 'Registration QR details are unavailable.');
			}

			const previousDateTimeSlot = registration.dateTimeSlot ? { ...registration.dateTimeSlot } : undefined;
			const registrationWithoutSubmission = { ...registration };
			delete registrationWithoutSubmission.dateTimeSlot;
			delete registrationWithoutSubmission.registrationSubmittedOn;
			delete registrationWithoutSubmission.previousDateTimeSlot;
			const newConfirmationCode = generateId(8);
			const replacementQrCodeStoragePath = createQrCodeStoragePath(uid);
			const cancelledOn = new Date();
			const cancellationRef = db.collection(COLLECTION_SCHEMA.cancellations).doc();
			const cancellation: RegistrationCancellation = {
				uid,
				actorUid,
				cancelledOn,
				programYear: PROGRAM_YEAR,
				previousDateTimeSlot,
				supersededConfirmationCode: registration.qrcode,
				supersededQrCodeStoragePath: registration.qrCodeStoragePath,
				replacementConfirmationCode: newConfirmationCode,
				replacementQrCodeStoragePath,
			};

			transaction.set(cancellationRef, cancellation);
			transaction.delete(indexRef);
			transaction.delete(emailRef);
			transaction.set(registrationRef, {
				...registrationWithoutSubmission,
				...(previousDateTimeSlot ? { previousDateTimeSlot } : {}),
				includedInCounts: false,
				includedInRegistrationStats: false,
				reminderEmailQueuedOn: false,
				reminderEmailSentOn: false,
				reminderEmailFailedOn: false,
				qrcode: newConfirmationCode,
				qrCodeStoragePath: replacementQrCodeStoragePath,
				qrCodeGeneratedOn: false,
				qrCodeGenerationFailedOn: false,
				cancelledOn,
				cancelledByUid: actorUid,
				cancellationLogId: cancellationRef.id,
			});
			transaction.create(receiptRef, {
				operation: 'undoRegistration',
				result: true,
				completedOn: cancelledOn,
			} satisfies MutationReceipt);
			result = {
				uid,
				newConfirmationCode,
				previousDateTimeSlot,
				emailAddress: registration.emailAddress,
				firstName: registration.firstName,
				supersededQrCodeStoragePath: registration.qrCodeStoragePath,
				replacementQrCodeStoragePath,
			};
		});

		if (!result) {
			throw new HttpsError('internal', 'Cancellation did not produce a result.');
		}
		await finalizeCancellation(registrationRef, result);
		return true;
	} catch (error) {
		if (error instanceof HttpsError) throw error;
		log.error('Failed to cancel registration', { uid, actorUid }, error);
		throw new HttpsError('internal', 'Unable to cancel registration.');
	}
}
