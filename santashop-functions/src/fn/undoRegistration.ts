import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	COLLECTION_SCHEMA,
	type DateTimeSlot,
	type PublicParameters,
	type Registration,
	type RegistrationCancellation,
} from '../models';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { serializeError } from '../utility/errors';
import { isAdminToken } from '../utility/capabilities';
import { generateId } from '../utility/id-generation';
import { deleteQrCode, generateQrCode } from '../utility/qrcodes';
import {
	formatRegistrationDateTime,
	type DateTimeValue,
} from '../utility/date-time-format';

const log = createFunctionLogger('undoRegistration');

interface UndoRegistrationRequest {
	uid?: string;
}

interface CancellationResult {
	uid: string;
	newConfirmationCode: string;
	previousDateTimeSlot?: Partial<DateTimeSlot>;
	emailAddress?: string;
	firstName?: string;
}

const queueCancellationEmail = async (
	result: CancellationResult,
): Promise<void> => {
	if (!result.emailAddress || !result.firstName) return;

	const queuedOn = new Date();
	await admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${result.uid}`)
		.set({
			code: result.newConfirmationCode,
			email: result.emailAddress,
			name: result.firstName,
			formattedDateTime: result.previousDateTimeSlot?.dateTime
				? formatRegistrationDateTime(
						result.previousDateTimeSlot.dateTime as DateTimeValue,
					)
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

export default async function undoRegistration(
	request: CallableRequest<UndoRegistrationRequest>,
): Promise<boolean> {
	const isAdmin = isAdminToken(request.auth?.token);
	const requestedUid = request.data?.uid;
	if (requestedUid && !isAdmin) {
		throw new HttpsError(
			'permission-denied',
			'Only staff can cancel another registration.',
		);
	}

	const uid = requestedUid ?? request.auth?.uid;
	if (!uid || !request.auth?.uid) {
		throw new HttpsError('unauthenticated', 'Authentication is required.');
	}

	const db = admin.firestore();
	const registrationDocRef = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const indexDocRef = db.doc(
		`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`,
	);
	const emailDocRef = db.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);
	const publicParametersRef = db.doc(`${COLLECTION_SCHEMA.parameters}/public`);
	const cancellationDocRef = db.collection(COLLECTION_SCHEMA.cancellations).doc();

	let result: CancellationResult | undefined;
	try {
		await db.runTransaction(async (transaction) => {
			const [registrationSnapshot, parametersSnapshot] = await Promise.all([
				transaction.get(registrationDocRef),
				transaction.get(publicParametersRef),
			]);

			if (!registrationSnapshot.exists) {
				throw new HttpsError('not-found', `Registration not found for ${uid}.`);
			}

			const parameters = parametersSnapshot.data() as
				| PublicParameters
				| undefined;
			if (!parameters?.admin?.allowCancelRegistration) {
				throw new HttpsError(
					'failed-precondition',
					'Registration cancellation is currently unavailable.',
				);
			}

			const registration = registrationSnapshot.data() as Registration;
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

			const previousDateTimeSlot = registration.dateTimeSlot
				? { ...registration.dateTimeSlot }
				: undefined;
			const {
				dateTimeSlot: _dateTimeSlot,
				registrationSubmittedOn: _registrationSubmittedOn,
				previousDateTimeSlot: _previousDateTimeSlot,
				...registrationWithoutSubmission
			} = registration;
			const newConfirmationCode = generateId(8);
			const cancelledOn = new Date();
			const cancellation: RegistrationCancellation = {
				uid,
				actorUid: request.auth!.uid,
				cancelledOn,
				previousDateTimeSlot,
				supersededConfirmationCode: registration.qrcode,
				replacementConfirmationCode: newConfirmationCode,
			};

			transaction.set(cancellationDocRef, cancellation);
			transaction.delete(indexDocRef);
			transaction.delete(emailDocRef);
			transaction.set(registrationDocRef, {
				...registrationWithoutSubmission,
				...(previousDateTimeSlot ? { previousDateTimeSlot } : {}),
				includedInCounts: false,
				includedInRegistrationStats: false,
				reminderEmailQueuedOn: false,
				reminderEmailSentOn: false,
				reminderEmailFailedOn: false,
				qrcode: newConfirmationCode,
				qrCodeGeneratedOn: false,
				qrCodeGenerationFailedOn: false,
				cancelledOn,
				cancelledByUid: request.auth!.uid,
				cancellationLogId: cancellationDocRef.id,
			});

			result = {
				uid,
				newConfirmationCode,
				previousDateTimeSlot,
				emailAddress: registration.emailAddress,
				firstName: registration.firstName,
			};
		});

		if (!result) {
			throw new HttpsError('internal', 'Cancellation did not produce a result.');
		}

		await deleteQrCode(uid);
		await generateQrCode(uid, result.newConfirmationCode);
		await registrationDocRef.set(
			{ qrCodeGeneratedOn: new Date(), qrCodeGenerationFailedOn: false },
			{ merge: true },
		);
		await queueCancellationEmail(result);
		return true;
	} catch (error) {
		if (error instanceof HttpsError) throw error;

		log.error(
			'Failed to cancel registration',
			{ uid, actorUid: request.auth?.uid ?? null },
			error,
		);
		throw new HttpsError(
			'internal',
			'Unable to cancel registration.',
			serializeError(error),
		);
	}
}
