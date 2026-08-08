import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import type { DocumentData, DocumentSnapshot } from 'firebase-admin/firestore';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	type CheckIn,
	type Registration,
	type RegistrationCancellation,
	type RegistrationScanAttempt,
	type RegistrationScanRiskSummary,
	type ResolveRegistrationScanResult,
	type ScanInputMethod,
} from '../models';
import { PROGRAM_YEAR } from './runtime-config';

export const ACCIDENTAL_RESCAN_THRESHOLD_MS = 5 * 60 * 1000;

export const classifyDuplicateScan = (
	priorEventOn: Date,
	now: Date,
): 'duplicate-accidental' | 'duplicate-risk' =>
	now.getTime() - priorEventOn.getTime() <= ACCIDENTAL_RESCAN_THRESHOLD_MS
		? 'duplicate-accidental'
		: 'duplicate-risk';

const dateFromValue = (value: unknown): Date | undefined => {
	if (value instanceof Date) return value;
	if (
		typeof value === 'object' &&
		value !== null &&
		'toDate' in value &&
		typeof value.toDate === 'function'
	) {
		return value.toDate() as Date;
	}
	return undefined;
};

const snapshotData = <T>(snapshot: DocumentSnapshot<DocumentData>): T =>
	({ id: snapshot.id, ...snapshot.data() }) as T;

export const fingerprintRegistrationCode = (code: string): string =>
	createHash('sha256').update(code).digest('hex');

const createAttempt = (
	customerId: string,
	scannerUid: string,
	code: string,
	inputMethod: ScanInputMethod,
	outcome: RegistrationScanAttempt['outcome'],
	priorEventOn: Date,
	now: Date,
): RegistrationScanAttempt => ({
	customerId,
	scannerUid,
	scannedOn: now,
	programYear: PROGRAM_YEAR,
	outcome,
	priorEventOn,
	elapsedSeconds: Math.max(
		0,
		Math.floor((now.getTime() - priorEventOn.getTime()) / 1000),
	),
	inputMethod,
	codeFingerprint: fingerprintRegistrationCode(code),
	codeSuffix: code.slice(-4),
});

const recordBlockedAttempt = async (
	registration: Registration,
	scannerUid: string,
	code: string,
	inputMethod: ScanInputMethod,
	outcome: RegistrationScanAttempt['outcome'],
	priorEventOn: Date,
	now: Date,
	originalCheckInOn?: Date,
): Promise<RegistrationScanAttempt> => {
	const customerId = registration.uid;
	if (!customerId) {
		throw new HttpsError('internal', 'Registration customer ID is unavailable.');
	}

	const db = admin.firestore();
	const attemptRef = db.collection(COLLECTION_SCHEMA.registrationScanAttempts).doc();
	const attempt = createAttempt(
		customerId,
		scannerUid,
		code,
		inputMethod,
		outcome,
		priorEventOn,
		now,
	);

	if (outcome === 'duplicate-accidental') {
		await attemptRef.create(attempt);
		return { id: attemptRef.id, ...attempt };
	}

	const summaryRef = db.doc(
		`${COLLECTION_SCHEMA.registrationScanRiskSummaries}/${PROGRAM_YEAR}_${customerId}`,
	);
	await db.runTransaction(async (transaction) => {
		const summarySnapshot = await transaction.get(summaryRef);
		const previous = summarySnapshot.data() as
			| RegistrationScanRiskSummary
			| undefined;
		const lateIncrement = outcome === 'duplicate-risk' ? 1 : 0;
		const cancelledIncrement = outcome === 'cancelled' ? 1 : 0;
		const summary: RegistrationScanRiskSummary = {
			customerId,
			programYear: PROGRAM_YEAR,
			firstName: registration.firstName ?? '',
			lastName: registration.lastName ?? '',
			emailAddress: registration.emailAddress ?? '',
			accidentalAttemptCount: previous?.accidentalAttemptCount ?? 0,
			lateDuplicateAttemptCount:
				(previous?.lateDuplicateAttemptCount ?? 0) + lateIncrement,
			cancelledCodeAttemptCount:
				(previous?.cancelledCodeAttemptCount ?? 0) + cancelledIncrement,
			totalRiskAttemptCount:
				(previous?.totalRiskAttemptCount ?? 0) + 1,
			firstRiskOn: dateFromValue(previous?.firstRiskOn) ?? now,
			latestRiskOn: now,
			latestOutcome: outcome,
			...(originalCheckInOn ? { originalCheckInOn } : {}),
		};
		transaction.create(attemptRef, attempt);
		transaction.set(summaryRef, summary);
	});

	return { id: attemptRef.id, ...attempt };
};

const cancellationForRegistration = async (
	registration: Registration,
): Promise<RegistrationCancellation | undefined> => {
	if (!registration.cancellationLogId) return undefined;
	const snapshot = await admin
		.firestore()
		.doc(
			`${COLLECTION_SCHEMA.cancellations}/${registration.cancellationLogId}`,
		)
		.get();
	return snapshot.exists
		? snapshotData<RegistrationCancellation>(snapshot)
		: undefined;
};

export const resolveRegistrationCode = async (
	code: string,
	inputMethod: ScanInputMethod,
	scannerUid: string,
	now = new Date(),
): Promise<ResolveRegistrationScanResult> => {
	const db = admin.firestore();
	const registrations = await db
		.collection(COLLECTION_SCHEMA.registrations)
		.where('qrcode', '==', code)
		.limit(2)
		.get();

	if (registrations.size > 1) {
		throw new HttpsError(
			'failed-precondition',
			'Multiple registrations use this confirmation code.',
		);
	}

	if (!registrations.empty) {
		const registration = snapshotData<Registration>(registrations.docs[0]);
		const customerId = registration.uid ?? registrations.docs[0].id;
		registration.uid = customerId;

		if (!registration.registrationSubmittedOn) {
			const cancelledOn = dateFromValue(registration.cancelledOn);
			if (!cancelledOn) {
				return { disposition: 'incomplete', customerId };
			}
			const cancellation = await cancellationForRegistration(registration);
			const attempt = await recordBlockedAttempt(
				registration,
				scannerUid,
				code,
				inputMethod,
				'cancelled',
				cancelledOn,
				now,
			);
			return {
				disposition: 'cancelled',
				registration,
				attempt,
				...(cancellation ? { cancellation } : {}),
			};
		}

		const checkInSnapshot = await db
			.doc(`${COLLECTION_SCHEMA.checkins}/${customerId}`)
			.get();
		if (!checkInSnapshot.exists) {
			return { disposition: 'eligible', registration };
		}

		const priorCheckIn = snapshotData<CheckIn>(checkInSnapshot);
		const checkInOn = dateFromValue(priorCheckIn.checkInDateTime);
		if (!checkInOn) {
			throw new HttpsError('internal', 'Prior check-in time is unavailable.');
		}
		const outcome = classifyDuplicateScan(checkInOn, now);
		const attempt = await recordBlockedAttempt(
			registration,
			scannerUid,
			code,
			inputMethod,
			outcome,
			checkInOn,
			now,
			checkInOn,
		);
		return { disposition: outcome, registration, attempt, priorCheckIn };
	}

	const cancellations = await db
		.collection(COLLECTION_SCHEMA.cancellations)
		.where('supersededConfirmationCode', '==', code)
		.limit(2)
		.get();
	if (cancellations.empty) return { disposition: 'not-found' };
	if (cancellations.size > 1) {
		throw new HttpsError(
			'failed-precondition',
			'Multiple cancellations use this confirmation code.',
		);
	}

	const cancellation = snapshotData<RegistrationCancellation>(
		cancellations.docs[0],
	);
	if (cancellation.programYear !== PROGRAM_YEAR) {
		return { disposition: 'not-found' };
	}
	const registrationSnapshot = await db
		.doc(`${COLLECTION_SCHEMA.registrations}/${cancellation.uid}`)
		.get();
	if (!registrationSnapshot.exists) {
		throw new HttpsError(
			'internal',
			'Cancelled registration record is unavailable.',
		);
	}
	const registration = snapshotData<Registration>(registrationSnapshot);
	registration.uid = cancellation.uid;
	const cancelledOn = dateFromValue(cancellation.cancelledOn);
	if (!cancelledOn) {
		throw new HttpsError('internal', 'Cancellation time is unavailable.');
	}
	const checkInSnapshot = await db
		.doc(`${COLLECTION_SCHEMA.checkins}/${cancellation.uid}`)
		.get();
	const priorCheckIn = checkInSnapshot.exists
		? snapshotData<CheckIn>(checkInSnapshot)
		: undefined;
	const originalCheckInOn = dateFromValue(priorCheckIn?.checkInDateTime);
	const attempt = await recordBlockedAttempt(
		registration,
		scannerUid,
		code,
		inputMethod,
		'cancelled',
		cancelledOn,
		now,
		originalCheckInOn,
	);
	return {
		disposition: 'cancelled',
		registration,
		attempt,
		cancellation,
		...(priorCheckIn ? { priorCheckIn } : {}),
	};
};

export const recordCheckInRaceAttempt = async (
	registration: Registration,
	scannerUid: string,
	inputMethod: ScanInputMethod,
	now = new Date(),
): Promise<ResolveRegistrationScanResult> => {
	if (!registration.qrcode) {
		throw new HttpsError('failed-precondition', 'Confirmation code is unavailable.');
	}
	return resolveRegistrationCode(
		registration.qrcode,
		inputMethod,
		scannerUid,
		now,
	);
};
