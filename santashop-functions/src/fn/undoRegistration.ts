import { getPublicParameters } from '../utility/public-parameters';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	type Registration,
	type RegistrationCancellation,
} from '../models';
import { isAdminToken } from '../utility/capabilities';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import {
	formatRegistrationDateTime,
	type DateTimeValue,
} from '../utility/date-time-format';
import { createFunctionLogger } from '../utility/observability';
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

const requireRegistrationUid = (value: unknown): string | undefined => {
	if (value === undefined) return undefined;
	if (typeof value !== 'string' || !value.trim()) {
		throw new HttpsError(
			'invalid-argument',
			'Registration UID is invalid.',
		);
	}
	return value;
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
		throw new HttpsError(
			'permission-denied',
			'Only staff can cancel another registration.',
		);
	}
	const uid = requestedUid ?? actorUid;
	const db = admin.firestore();
	const registrationRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const indexRef = db.doc(
		`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`,
	);
	const parameters = await getPublicParameters();
	const receiptRef = registrationRef
		.collection(MUTATION_RECEIPTS_SUBCOLLECTION)
		.doc(mutationId);
	try {
		await db.runTransaction(async (transaction) => {
			const [registrationSnapshot, receiptSnapshot] = await Promise.all([
				transaction.get(registrationRef),
				transaction.get(receiptRef),
			]);
			const cached = getStoredMutationResult(
				receiptSnapshot.exists
					? (receiptSnapshot.data() as MutationReceipt)
					: undefined,
				'undoRegistration',
			);
			const registration = registrationSnapshot.data() as
				Registration | undefined;
			if (!registration) {
				throw new HttpsError(
					'not-found',
					`Registration not found for ${uid}.`,
				);
			}
			if (cached || registration.cancelledOn) {
				if (!registration.cancellationLogId) {
					throw new HttpsError(
						'internal',
						'Cancellation record is unavailable.',
					);
				}
				const cancellationSnapshot = await transaction.get(
					db.doc(
						`${COLLECTION_SCHEMA.cancellations}/${registration.cancellationLogId}`,
					),
				);
				const cancellation = cancellationSnapshot.data() as
					RegistrationCancellation | undefined;
				if (!cancellation) {
					throw new HttpsError(
						'internal',
						'Cancellation record is unavailable.',
					);
				}
				if (!cached) {
					transaction.create(receiptRef, {
						operation: 'undoRegistration',
						result: true,
						completedOn: new Date(),
					} satisfies MutationReceipt);
				}
				return;
			}

			if (!parameters?.admin?.allowCancelRegistration) {
				throw new HttpsError(
					'failed-precondition',
					'Registration cancellation is currently unavailable.',
				);
			}
			if (!registration.registrationSubmittedOn) {
				throw new HttpsError(
					'failed-precondition',
					'Only submitted registrations can be cancelled.',
				);
			}
			if (registration.hasCheckedIn) {
				throw new HttpsError(
					'failed-precondition',
					'Checked-in registrations cannot be cancelled.',
				);
			}
			if (!registration.qrcode || !registration.qrCodeStoragePath) {
				throw new HttpsError(
					'failed-precondition',
					'Registration QR details are unavailable.',
				);
			}

			const previousDateTimeSlot = registration.dateTimeSlot
				? { ...registration.dateTimeSlot }
				: undefined;
			const registrationWithoutSubmission = { ...registration };
			delete registrationWithoutSubmission.dateTimeSlot;
			delete registrationWithoutSubmission.registrationSubmittedOn;
			delete registrationWithoutSubmission.previousDateTimeSlot;
			const cancelledOn = new Date();
			const cancellationRef = db
				.collection(COLLECTION_SCHEMA.cancellations)
				.doc();
			const cancellationEmailRef = db
				.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
				.doc();
			const cancellation: RegistrationCancellation = {
				uid,
				actorUid,
				cancelledOn,
				programYear: PROGRAM_YEAR,
				previousDateTimeSlot,
				supersededConfirmationCode: registration.qrcode,
				supersededQrCodeStoragePath: registration.qrCodeStoragePath,
				replacementConfirmationCode: registration.qrcode,
				replacementQrCodeStoragePath: registration.qrCodeStoragePath,
			};

			transaction.set(cancellationRef, cancellation);
			if (registration.emailAddress && registration.firstName) {
				transaction.create(cancellationEmailRef, {
					registrationUid: uid,
					cancellationLogId: cancellationRef.id,
					code: registration.qrcode,
					email: registration.emailAddress,
					name: registration.firstName,
					formattedDateTime: previousDateTimeSlot?.dateTime
						? formatRegistrationDateTime(
								previousDateTimeSlot.dateTime as DateTimeValue,
							)
						: 'your previous appointment',
					queuedOn: cancelledOn,
					queueSource: 'registration-cancellation',
					templateKey: 'registration-cancellation',
					...(previousDateTimeSlot?.dateTime
						? { appointmentDateTime: previousDateTimeSlot.dateTime }
						: {}),
					deliveryRequestedOn: cancelledOn,
					deliveryState: 'queued',
					failedOn: false,
					lastErrorMessage: false,
					lastErrorDetails: false,
				});
			}
			transaction.delete(indexRef);
			transaction.set(registrationRef, {
				...registrationWithoutSubmission,
				...(previousDateTimeSlot ? { previousDateTimeSlot } : {}),
				includedInCounts: false,
				includedInRegistrationStats: false,
				reminderEmailQueuedOn: false,
				reminderEmailSentOn: false,
				reminderEmailFailedOn: false,
				cancelledOn,
				cancelledByUid: actorUid,
				cancellationLogId: cancellationRef.id,
			});
			transaction.create(receiptRef, {
				operation: 'undoRegistration',
				result: true,
				completedOn: cancelledOn,
			} satisfies MutationReceipt);
		});
		return true;
	} catch (error) {
		if (error instanceof HttpsError) throw error;
		log.error('Failed to cancel registration', { uid, actorUid }, error);
		throw new HttpsError('internal', 'Unable to cancel registration.');
	}
}
