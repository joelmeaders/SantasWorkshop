/**
 * Test helper functions for E2E testing
 * These functions should only be available in emulator mode
 */

import { createHash } from 'node:crypto';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import admin from '../firebase-admin';
import cancelledRegistrationDataUrl from '../assets/cancelled-registration.png';
import { PROGRAM_YEAR } from '../utility/runtime-config';

export interface TestAdminUserSeed {
	uid?: string;
	emailAddress: string;
	password: string;
	admin?: boolean;
	owner?: boolean;
	roles?: ('admin' | 'checkin')[];
}

export interface TestDateTimeSlotSeed {
	id?: string;
	programYear: number;
	dateTime: string;
	maxSlots: number;
	slotsReserved?: number;
	enabled?: boolean;
	lastUpdated?: string;
}

export interface TestRegistrationSearchIndexSeed {
	id?: string;
	firstName: string;
	lastName: string;
	emailAddress: string;
	customerId: string;
	zip: string;
	code?: string;
}

export interface TestScheduleStatsSeed {
	programYear: number;
	dateTimeCounts: { dateTime: string; count: number }[];
}

export interface TestRegistrationStatsSeed {
	programYear: number;
	completedRegistrations: number;
	dateTimeCount: {
		dateTime: string;
		count: number;
		childCount: number;
		stats: {
			infants: Record<string, number>;
			girls: Record<string, number>;
			boys: Record<string, number>;
		};
	}[];
	zipCodeCount: { zip: number; count: number; childCount: number }[];
}

export interface TestCheckInStatsSeed {
	programYear: number;
	lastUpdated: string;
	dateTimeCount: {
		date: number;
		hour: number;
		customerCount: number;
		childCount: number;
		pregisteredCount: number;
		modifiedCount: number;
	}[];
}

export interface TestUserStatsSeed {
	programYear: number;
	totalUsers: number;
	zipCodeCount: { zip: string; count: number }[];
	referrerCount: { referrer: string; count: number }[];
}

export interface TestRegistrationSeed {
	uid: string;
	firstName: string;
	lastName: string;
	emailAddress: string;
	zipCode: string;
	code: string;
	dateTime: string;
	children?: { firstName: string; lastName: string; dateOfBirth: string; ageGroup: string }[];
	hasCheckedIn?: boolean;
	checkInDateTime?: string;
	qrReady?: boolean;
	/** Stores a code-bearing record that has not been submitted or cancelled. */
	incomplete?: boolean;
	cancellation?: {
		supersededCode: string;
		cancelledOn?: string;
		/** Makes the replacement code eligible while retaining the old cancellation audit. */
		reRegistered?: boolean;
	};
}

export interface TestStorageObjectInfo {
	exists: boolean;
	md5Hash?: string;
	cacheControl?: string;
	contentType?: string;
	size?: string;
	width?: number;
	height?: number;
	/** True only when the stored bytes match the bundled cancelled-registration asset. */
	matchesCancelledAsset?: boolean;
}

export interface TestScanAttemptSeed {
	id?: string;
	customerId: string;
	scannerUid?: string;
	scannedOn: string;
	priorEventOn: string;
	programYear?: number;
	outcome: 'duplicate-accidental' | 'duplicate-risk' | 'cancelled';
	inputMethod?: 'camera' | 'manual';
	codeSuffix?: string;
}

export interface TestScanRiskSummarySeed {
	id?: string;
	customerId: string;
	firstName: string;
	lastName: string;
	emailAddress: string;
	firstRiskOn: string;
	latestRiskOn: string;
	programYear?: number;
	accidentalAttemptCount?: number;
	lateDuplicateAttemptCount?: number;
	cancelledCodeAttemptCount?: number;
	totalRiskAttemptCount?: number;
	latestOutcome?: 'duplicate-risk' | 'cancelled';
	originalCheckInOn?: string;
}

export interface TestScanRiskHistorySeed {
	attempts?: TestScanAttemptSeed[];
	summaries?: TestScanRiskSummarySeed[];
}

export interface TestRegistrationScanAudit {
	uid: string;
	rawCodePersisted: boolean;
	attempts: {
		id: string;
		customerId: string;
		scannerUid: string;
		scannedOn: string;
		priorEventOn: string;
		programYear: number;
		outcome: 'duplicate-accidental' | 'duplicate-risk' | 'cancelled';
		elapsedSeconds: number;
		inputMethod: 'camera' | 'manual';
		codeFingerprint: string;
		codeSuffix: string;
	}[];
	summaries: {
		id: string;
		customerId: string;
		programYear: number;
		firstName: string;
		lastName: string;
		emailAddress: string;
		accidentalAttemptCount: number;
		lateDuplicateAttemptCount: number;
		cancelledCodeAttemptCount: number;
		totalRiskAttemptCount: number;
		firstRiskOn: string;
		latestRiskOn: string;
		latestOutcome: 'duplicate-risk' | 'cancelled';
		originalCheckInOn?: string;
	}[];
}

export interface TestQueuedRegistrationEmailSnapshot {
	id: string;
	collection: 'tmp_registrationemails' | 'tmp_registrationemails2';
	queueSource?: string;
	deliveryState?: string;
	qrCodeStoragePath?: string;
	hasConfirmationCode: boolean;
	queuedOn?: string;
}

export interface TestRegistrationQrLifecycle {
	uid: string;
	registration: {
		hasSubmittedRegistration: boolean;
		cancelled: boolean;
		dateTimeSlot?: { id?: string; dateTime?: string };
		previousDateTimeSlot?: { id?: string; dateTime?: string };
	};
	searchIndex: {
		exists: boolean;
		customerId?: string;
		code?: string;
		firstName?: string;
		lastName?: string;
		displayFirstName?: string;
		displayLastName?: string;
		emailAddress?: string;
		zip?: string;
	};
	slots: {
		current?: { id: string; maxSlots?: number; slotsReserved?: number; enabled?: boolean };
		previous?: { id: string; maxSlots?: number; slotsReserved?: number; enabled?: boolean };
	};
	current: {
		code?: string;
		path?: string;
		object: TestStorageObjectInfo;
	};
	latestCancellation?: {
		supersededCode: string;
		supersededPath: string;
		replacementCode: string;
		replacementPath: string;
		supersededObject: TestStorageObjectInfo;
		replacementObject: TestStorageObjectInfo;
	};
	cancellationHistory: {
		supersededCode: string;
		supersededPath: string;
		replacementCode: string;
		replacementPath: string;
		cancelledOn: string;
	}[];
}

export interface TestPublicParameters {
	registrationEnabled?: boolean;
	maintenanceModeEnabled?: boolean;
	weatherModeEnabled?: boolean;
	createAccountEnabled?: boolean;
	messageEn?: string;
	messageEs?: string;
	admin?: {
		checkinEnabled?: boolean;
		onsiteRegistrationEnabled?: boolean;
		preRegistrationEnabled?: boolean;
		allowCancelRegistration?: boolean;
		allowChangeRegistration?: boolean;
	};
	globalAlert?: {
		displayAlert?: boolean;
		titleEn?: string;
		titleEs?: string;
		messageEn?: string;
		messageEs?: string;
	};
}

/**
 * Seeds the Firestore database with public parameters for testing
 * @param params - The parameters to seed
 */
export async function seedPublicParameters(
	params: TestPublicParameters,
): Promise<void> {
	const db = admin.firestore();

	const defaultParams = {
		registrationEnabled: true,
		maintenanceModeEnabled: false,
		weatherModeEnabled: false,
		createAccountEnabled: true,
		messageEn: '',
		messageEs: '',
		admin: {
			checkinEnabled: true,
			onsiteRegistrationEnabled: true,
			preRegistrationEnabled: true,
			allowCancelRegistration: true,
			allowChangeRegistration: true,
		},
		globalAlert: {
			displayAlert: false,
			titleEn: '',
			titleEs: '',
			messageEn: '',
			messageEs: '',
		},
	};

	const mergedParams = { ...defaultParams, ...params };

	await db.collection('parameters').doc('public').set(mergedParams);
}

/**
 * Clears all data from Firestore, Auth, and Storage
 * WARNING: This will delete all data in the emulator
 */
export async function clearAllData(): Promise<void> {
	const db = admin.firestore();
	const auth = admin.auth();

	// Clear Firestore collections
	const collections = [
		'checkins',
		'cancellations',
		'registrationScanAttempts',
		'registrationScanRiskSummaries',
		'users',
		'registrations',
		'editedregistrations',
		'onsiteregistrations',
		'children',
		'dateTimeSlots',
		'emailTemplates',
		'registrationsearchindex',
		'stats',
		'tmp_registrationemails',
		'tmp_registrationemails2',
		'parameters',
		'staff',
	];

	for (const collectionName of collections) {
		const snapshot = await db.collection(collectionName).get();
		const batch = db.batch();
		snapshot.docs.forEach((doc) => {
			batch.delete(doc.ref);
		});
		await batch.commit();
	}

	// Clear Auth users
	const listUsersResult = await auth.listUsers();
	const deletePromises = listUsersResult.users.map((user) =>
		auth.deleteUser(user.uid),
	);
	await Promise.all(deletePromises);

	// Keep cleanup deliberately scoped to prefixes Functions creates in E2E. This
	// prevents one E2E run from inheriting immutable QR/template assets from a
	// prior test while avoiding any non-emulator bucket-wide operation.
	const bucket = admin.storage().bucket();
	for (const prefix of ['registrations/', 'emailTemplates/']) {
		const [files] = await bucket.getFiles({ prefix });
		await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
	}
}

/**
 * Seeds an admin user in the Auth emulator.
 */
export async function seedAdminUser(
	user: TestAdminUserSeed,
): Promise<{ uid: string }> {
	const auth = admin.auth();
	const emailAddress = user.emailAddress.toLowerCase();

	try {
		const existingUser = await auth.getUserByEmail(emailAddress);
		await auth.deleteUser(existingUser.uid);
	} catch (error: unknown) {
		const code = (error as { code?: string }).code;

		if (code !== 'auth/user-not-found') {
			throw error;
		}
	}

	if (user.uid) {
		try {
			await auth.deleteUser(user.uid);
		} catch (error: unknown) {
			const code = (error as { code?: string }).code;

			if (code !== 'auth/user-not-found') {
				throw error;
			}
		}
	}

	const createdUser = await auth.createUser({
		uid: user.uid,
		email: emailAddress,
		password: user.password,
		emailVerified: true,
	});

	await auth.setCustomUserClaims(createdUser.uid, {
		admin: user.admin ?? true,
		owner: user.owner ?? false,
		roles:
			user.roles ??
			(user.owner || user.admin !== false ? ['admin', 'checkin'] : []),
	});

	return { uid: createdUser.uid };
}

/**
 * Seeds date/time slots in Firestore for schedule-editor testing.
 */
export async function seedDateTimeSlots(
	slots: TestDateTimeSlotSeed[],
): Promise<{ ids: string[] }> {
	const db = admin.firestore();
	const ids: string[] = [];

	for (const slot of slots) {
		const docRef = slot.id
			? db.collection('dateTimeSlots').doc(slot.id)
			: db.collection('dateTimeSlots').doc();
		const dateTime = new Date(slot.dateTime);
		const lastUpdated = slot.lastUpdated
			? new Date(slot.lastUpdated)
			: new Date();

		if (Number.isNaN(dateTime.getTime())) {
			throw new Error(`Invalid dateTime for test slot ${docRef.id}.`);
		}
		if (Number.isNaN(lastUpdated.getTime())) {
			throw new Error(`Invalid lastUpdated for test slot ${docRef.id}.`);
		}

		await docRef.set({
			programYear: slot.programYear,
			dateTime,
			maxSlots: slot.maxSlots,
			slotsReserved: slot.slotsReserved ?? 0,
			enabled: slot.enabled ?? true,
			lastUpdated,
		});

		ids.push(docRef.id);
	}

	return { ids };
}

/**
 * Seeds submitted-registration lookup index documents for staff E2E tests.
 */
export async function seedRegistrationSearchIndex(
	records: TestRegistrationSearchIndexSeed[],
): Promise<{ ids: string[] }> {
	const db = admin.firestore();
	const ids: string[] = [];

	for (const record of records) {
		const docRef = record.id
			? db.collection('registrationsearchindex').doc(record.id)
			: db.collection('registrationsearchindex').doc();
		await docRef.set({
			firstName: record.firstName,
			lastName: record.lastName.toLowerCase(),
			displayFirstName: record.firstName,
			displayLastName: record.lastName,
			emailAddress: record.emailAddress.toLowerCase(),
			customerId: record.customerId,
			zip: record.zip,
			code: record.code?.toUpperCase(),
		});
		ids.push(docRef.id);
	}

	return { ids };
}

/** Seeds a complete customer registration and its lookup index for browser flows. */
export async function seedRegistration(
	seed: TestRegistrationSeed,
): Promise<void> {
	if (seed.incomplete && seed.cancellation) {
		throw new Error('A seeded registration cannot be both incomplete and cancelled.');
	}
	const dateTime = new Date(seed.dateTime);
	if (Number.isNaN(dateTime.getTime())) {
		throw new Error(`Invalid registration dateTime: ${seed.dateTime}.`);
	}
	const children = (seed.children ?? [
		{ firstName: 'Test', lastName: 'Child', dateOfBirth: '2018-01-01', ageGroup: '5-11' },
	]).map((child, index) => ({ ...child, id: index + 1, dateOfBirth: new Date(child.dateOfBirth) }));
	const db = admin.firestore();
	await db.collection('users').doc(seed.uid).set({
		firstName: seed.firstName,
		lastName: seed.lastName,
		emailAddress: seed.emailAddress.toLowerCase(),
		zipCode: seed.zipCode,
		acceptedTermsOfService: new Date(),
		acceptedPrivacyPolicy: new Date(),
		version: 1,
	});
	const currentQrPath = seed.cancellation
		? `registrations/${seed.uid}/e2e-replacement.png`
		: `registrations/${seed.uid}/e2e-seeded.png`;
	const cancellationTime = seed.cancellation?.cancelledOn
		? new Date(seed.cancellation.cancelledOn)
		: new Date();
	if (Number.isNaN(cancellationTime.getTime())) {
		throw new Error(`Invalid cancellation date: ${seed.cancellation?.cancelledOn}.`);
	}
	const cancellationId = `${seed.uid}-e2e-cancellation`;
	await db.collection('registrations').doc(seed.uid).set({
		uid: seed.uid,
		firstName: seed.firstName,
		lastName: seed.lastName,
		emailAddress: seed.emailAddress.toLowerCase(),
		zipCode: seed.zipCode,
		qrcode: seed.code.toUpperCase(),
		qrCodeStoragePath: currentQrPath,
		children,
		...(seed.incomplete
			? {}
			: seed.cancellation && !seed.cancellation.reRegistered
			? {
				cancelledOn: cancellationTime,
				cancelledByUid: seed.uid,
				cancellationLogId: cancellationId,
				previousDateTimeSlot: { id: 'e2e-registration-slot', dateTime },
			}
			: {
				dateTimeSlot: { id: 'e2e-registration-slot', dateTime },
				registrationSubmittedOn: new Date(),
			}),
		includedInCounts: false,
		includedInRegistrationStats: false,
		programYear: PROGRAM_YEAR,
		hasCheckedIn: seed.hasCheckedIn ?? false,
		qrCodeGeneratedOn: seed.qrReady === false ? false : new Date(),
		qrCodeGenerationFailedOn: false,
	});
	if (seed.cancellation) {
		await db.collection('cancellations').doc(cancellationId).set({
			uid: seed.uid,
			actorUid: seed.uid,
			cancelledOn: cancellationTime,
			programYear: PROGRAM_YEAR,
			previousDateTimeSlot: { id: 'e2e-registration-slot', dateTime },
			supersededConfirmationCode: seed.cancellation.supersededCode.toUpperCase(),
			supersededQrCodeStoragePath: `registrations/${seed.uid}/e2e-superseded.png`,
			replacementConfirmationCode: seed.code.toUpperCase(),
			replacementQrCodeStoragePath: currentQrPath,
		});
	}
	if (seed.hasCheckedIn) {
		await db.collection('checkins').doc(seed.uid).set({
			checkInDateTime: seed.checkInDateTime
				? new Date(seed.checkInDateTime)
				: new Date(),
			customerId: seed.uid,
			registrationCode: seed.code.toUpperCase(),
			inStats: false,
			stats: { children: children.length },
		});
	}
	if (!seed.cancellation || seed.cancellation.reRegistered) await seedRegistrationSearchIndex([{
		id: seed.uid,
		firstName: seed.firstName.toLowerCase(),
		lastName: seed.lastName,
		emailAddress: seed.emailAddress,
		customerId: seed.uid,
		zip: seed.zipCode,
		code: seed.code,
	}]);
}

const cancelledAsset = Buffer.from(
	cancelledRegistrationDataUrl.split(',', 2)[1] ?? '',
	'base64',
);
const cancelledAssetHash = createHash('sha256').update(cancelledAsset).digest('hex');

const pngDimensions = (contents: Buffer): { width: number; height: number } | undefined => {
	const pngSignature = '89504e470d0a1a0a';
	if (contents.subarray(0, 8).toString('hex') !== pngSignature) return undefined;
	if (contents.subarray(12, 16).toString('ascii') !== 'IHDR') return undefined;
	if (contents.length < 24) return undefined;
	return {
		width: contents.readUInt32BE(16),
		height: contents.readUInt32BE(20),
	};
};

const storageObjectInfo = async (path?: string): Promise<TestStorageObjectInfo> => {
	if (!path) return { exists: false };
	const file = admin.storage().bucket().file(path);
	const [exists] = await file.exists();
	if (!exists) return { exists: false };
	const [[metadata], [contents]] = await Promise.all([
		file.getMetadata(),
		file.download(),
	]);
	const dimensions = pngDimensions(contents);
	return {
		exists: true,
		...(metadata.md5Hash ? { md5Hash: metadata.md5Hash } : {}),
		...(metadata.cacheControl ? { cacheControl: metadata.cacheControl } : {}),
		...(metadata.contentType ? { contentType: metadata.contentType } : {}),
		...(metadata.size ? { size: String(metadata.size) } : {}),
		...(dimensions ?? {}),
		matchesCancelledAsset:
			createHash('sha256').update(contents).digest('hex') === cancelledAssetHash,
	};
};

/** Reads QR lifecycle evidence from the emulators without exposing it to production. */
export async function inspectRegistrationQrLifecycle(
	emailAddress: string,
): Promise<TestRegistrationQrLifecycle> {
	const authUser = await admin.auth().getUserByEmail(emailAddress.toLowerCase());
	const db = admin.firestore();
	const registrationSnapshot = await db.collection('registrations').doc(authUser.uid).get();
	const registration = registrationSnapshot.data() as {
		qrcode?: string;
		qrCodeStoragePath?: string;
		registrationSubmittedOn?: unknown;
		cancelledOn?: unknown;
		dateTimeSlot?: { id?: string; dateTime?: unknown };
		previousDateTimeSlot?: { id?: string; dateTime?: unknown };
	} | undefined;
	if (!registration) throw new Error(`Registration not found for ${authUser.uid}.`);

	const [cancellationsSnapshot, searchIndexSnapshot, currentSlotSnapshot, previousSlotSnapshot] = await Promise.all([
		db.collection('cancellations').where('uid', '==', authUser.uid).get(),
		db.collection('registrationsearchindex').doc(authUser.uid).get(),
		registration.dateTimeSlot?.id
			? db.collection('dateTimeSlots').doc(registration.dateTimeSlot.id).get()
			: Promise.resolve(undefined),
		registration.previousDateTimeSlot?.id
			? db.collection('dateTimeSlots').doc(registration.previousDateTimeSlot.id).get()
			: Promise.resolve(undefined),
	]);
	const cancellations = cancellationsSnapshot.docs
		.map((document) => document.data() as {
			cancelledOn: { toDate?: () => Date } | Date;
			supersededConfirmationCode: string;
			supersededQrCodeStoragePath: string;
			replacementConfirmationCode: string;
			replacementQrCodeStoragePath: string;
		})
		.sort((left, right) => {
			const leftDate = left.cancelledOn instanceof Date
				? left.cancelledOn
				: left.cancelledOn.toDate?.() ?? new Date(0);
			const rightDate = right.cancelledOn instanceof Date
				? right.cancelledOn
				: right.cancelledOn.toDate?.() ?? new Date(0);
			return rightDate.getTime() - leftDate.getTime();
		});
	const latestCancellation = cancellations[0];
	const slot = (
		value?: { id?: string; dateTime?: unknown },
	): { id?: string; dateTime?: string } => {
		const dateTime = asDate(value?.dateTime);
		return {
			...(value?.id ? { id: value.id } : {}),
			...(dateTime
				? { dateTime: dateTime.toISOString() }
				: typeof value?.dateTime === 'string' ? { dateTime: value.dateTime } : {}),
		};
	};
	const searchIndex = searchIndexSnapshot.data() as {
		customerId?: string;
		code?: string;
		firstName?: string;
		lastName?: string;
		displayFirstName?: string;
		displayLastName?: string;
		emailAddress?: string;
		zip?: string;
	} | undefined;
	const slotSnapshot = (
		snapshot: DocumentSnapshot | undefined,
	): { id: string; maxSlots?: number; slotsReserved?: number; enabled?: boolean } | undefined => {
		if (!snapshot?.exists) return undefined;
		const data = snapshot.data() as {
			maxSlots?: number;
			slotsReserved?: number;
			enabled?: boolean;
		};
		return {
			id: snapshot.id,
			...(typeof data.maxSlots === 'number' ? { maxSlots: data.maxSlots } : {}),
			...(typeof data.slotsReserved === 'number' ? { slotsReserved: data.slotsReserved } : {}),
			...(typeof data.enabled === 'boolean' ? { enabled: data.enabled } : {}),
		};
	};
	const currentSlot = slotSnapshot(currentSlotSnapshot);
	const previousSlot = slotSnapshot(previousSlotSnapshot);

	return {
		uid: authUser.uid,
		registration: {
			hasSubmittedRegistration: Boolean(registration.registrationSubmittedOn),
			cancelled: Boolean(registration.cancelledOn),
			...(registration.dateTimeSlot ? { dateTimeSlot: slot(registration.dateTimeSlot) } : {}),
			...(registration.previousDateTimeSlot ? { previousDateTimeSlot: slot(registration.previousDateTimeSlot) } : {}),
		},
		searchIndex: {
			exists: searchIndexSnapshot.exists,
			...(searchIndex?.customerId ? { customerId: searchIndex.customerId } : {}),
			...(searchIndex?.code ? { code: searchIndex.code } : {}),
			...(searchIndex?.firstName ? { firstName: searchIndex.firstName } : {}),
			...(searchIndex?.lastName ? { lastName: searchIndex.lastName } : {}),
			...(searchIndex?.displayFirstName ? { displayFirstName: searchIndex.displayFirstName } : {}),
			...(searchIndex?.displayLastName ? { displayLastName: searchIndex.displayLastName } : {}),
			...(searchIndex?.emailAddress ? { emailAddress: searchIndex.emailAddress } : {}),
			...(searchIndex?.zip ? { zip: searchIndex.zip } : {}),
		},
		slots: {
			...(currentSlot ? { current: currentSlot } : {}),
			...(previousSlot ? { previous: previousSlot } : {}),
		},
		current: {
			...(registration.qrcode ? { code: registration.qrcode } : {}),
			...(registration.qrCodeStoragePath ? { path: registration.qrCodeStoragePath } : {}),
			object: await storageObjectInfo(registration.qrCodeStoragePath),
		},
		...(latestCancellation
			? {
				latestCancellation: {
					supersededCode: latestCancellation.supersededConfirmationCode,
					supersededPath: latestCancellation.supersededQrCodeStoragePath,
					replacementCode: latestCancellation.replacementConfirmationCode,
					replacementPath: latestCancellation.replacementQrCodeStoragePath,
					supersededObject: await storageObjectInfo(
						latestCancellation.supersededQrCodeStoragePath,
					),
					replacementObject: await storageObjectInfo(
						latestCancellation.replacementQrCodeStoragePath,
					),
				},
			}
			: {}),
		cancellationHistory: cancellations.map((cancellation) => {
			const cancelledOn = cancellation.cancelledOn instanceof Date
				? cancellation.cancelledOn
				: cancellation.cancelledOn.toDate?.() ?? new Date(0);
			return {
				supersededCode: cancellation.supersededConfirmationCode,
				supersededPath: cancellation.supersededQrCodeStoragePath,
				replacementCode: cancellation.replacementConfirmationCode,
				replacementPath: cancellation.replacementQrCodeStoragePath,
				cancelledOn: cancelledOn.toISOString(),
			};
		}),
	};
}

const requiredDate = (value: string, label: string): Date => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${label}: ${value}.`);
	return date;
};

/**
 * Seeds paginated, multi-day scan-risk data without ever accepting or storing a
 * raw confirmation code. Omitted program years always use the configured year.
 */
export async function seedScanRiskHistory(
	seed: TestScanRiskHistorySeed,
): Promise<void> {
	const db = admin.firestore();
	const writes: Promise<unknown>[] = [];
	for (const attempt of seed.attempts ?? []) {
		const scannedOn = requiredDate(attempt.scannedOn, 'scan attempt date');
		const priorEventOn = requiredDate(attempt.priorEventOn, 'scan attempt prior date');
		const ref = attempt.id
			? db.collection('registrationScanAttempts').doc(attempt.id)
			: db.collection('registrationScanAttempts').doc();
		writes.push(ref.set({
			customerId: attempt.customerId,
			scannerUid: attempt.scannerUid ?? 'e2e-scanner',
			scannedOn,
			priorEventOn,
			programYear: attempt.programYear ?? PROGRAM_YEAR,
			outcome: attempt.outcome,
			elapsedSeconds: Math.max(0, Math.floor((scannedOn.getTime() - priorEventOn.getTime()) / 1000)),
			inputMethod: attempt.inputMethod ?? 'camera',
			codeFingerprint: createHash('sha256').update(`e2e:${ref.id}`).digest('hex'),
			codeSuffix: attempt.codeSuffix ?? 'E2E0',
		}));
	}
	for (const summary of seed.summaries ?? []) {
		const ref = summary.id
			? db.collection('registrationScanRiskSummaries').doc(summary.id)
			: db.collection('registrationScanRiskSummaries').doc();
		const lateDuplicateAttemptCount = summary.lateDuplicateAttemptCount ?? 0;
		const cancelledCodeAttemptCount = summary.cancelledCodeAttemptCount ?? 0;
		writes.push(ref.set({
			customerId: summary.customerId,
			programYear: summary.programYear ?? PROGRAM_YEAR,
			firstName: summary.firstName,
			lastName: summary.lastName,
			emailAddress: summary.emailAddress.toLowerCase(),
			accidentalAttemptCount: summary.accidentalAttemptCount ?? 0,
			lateDuplicateAttemptCount,
			cancelledCodeAttemptCount,
			totalRiskAttemptCount: summary.totalRiskAttemptCount ?? lateDuplicateAttemptCount + cancelledCodeAttemptCount,
			firstRiskOn: requiredDate(summary.firstRiskOn, 'first risk date'),
			latestRiskOn: requiredDate(summary.latestRiskOn, 'latest risk date'),
			latestOutcome: summary.latestOutcome ?? (cancelledCodeAttemptCount ? 'cancelled' : 'duplicate-risk'),
			...(summary.originalCheckInOn
				? { originalCheckInOn: requiredDate(summary.originalCheckInOn, 'original check-in date') }
				: {}),
		}));
	}
	await Promise.all(writes);
}

const asDate = (value: unknown): Date | undefined =>
	value instanceof Date
		? value
		: typeof value === 'object' && value !== null && 'toDate' in value &&
			typeof value.toDate === 'function'
			? value.toDate() as Date
			: undefined;

/** Reads only display-safe audit fields so E2E can prove raw codes are absent. */
export async function inspectRegistrationScanAudit(
	emailAddress: string,
): Promise<TestRegistrationScanAudit> {
	const authUser = await admin.auth().getUserByEmail(emailAddress.toLowerCase());
	const db = admin.firestore();
	const [attemptSnapshots, summarySnapshots] = await Promise.all([
		db.collection('registrationScanAttempts').where('customerId', '==', authUser.uid).get(),
		db.collection('registrationScanRiskSummaries').where('customerId', '==', authUser.uid).get(),
	]);
	let rawCodePersisted = false;
	const attempts = attemptSnapshots.docs.map((snapshot) => {
		const data = snapshot.data();
		rawCodePersisted ||= 'code' in data || 'rawCode' in data || 'confirmationCode' in data;
		const scannedOn = asDate(data['scannedOn']) ?? new Date(0);
		const priorEventOn = asDate(data['priorEventOn']) ?? new Date(0);
		return {
			id: snapshot.id,
			customerId: String(data['customerId'] ?? ''),
			scannerUid: String(data['scannerUid'] ?? ''),
			scannedOn: scannedOn.toISOString(),
			priorEventOn: priorEventOn.toISOString(),
			programYear: Number(data['programYear']),
			outcome: data['outcome'] as TestRegistrationScanAudit['attempts'][number]['outcome'],
			elapsedSeconds: Number(data['elapsedSeconds'] ?? 0),
			inputMethod: data['inputMethod'] as 'camera' | 'manual',
			codeFingerprint: String(data['codeFingerprint'] ?? ''),
			codeSuffix: String(data['codeSuffix'] ?? ''),
		};
	}).sort((left, right) => right.scannedOn.localeCompare(left.scannedOn));
	const summaries = summarySnapshots.docs.map((snapshot) => {
		const data = snapshot.data();
		const originalCheckInOn = asDate(data['originalCheckInOn']);
		return {
			id: snapshot.id,
			customerId: String(data['customerId'] ?? ''),
			programYear: Number(data['programYear']),
			firstName: String(data['firstName'] ?? ''),
			lastName: String(data['lastName'] ?? ''),
			emailAddress: String(data['emailAddress'] ?? ''),
			accidentalAttemptCount: Number(data['accidentalAttemptCount'] ?? 0),
			lateDuplicateAttemptCount: Number(data['lateDuplicateAttemptCount'] ?? 0),
			cancelledCodeAttemptCount: Number(data['cancelledCodeAttemptCount'] ?? 0),
			totalRiskAttemptCount: Number(data['totalRiskAttemptCount'] ?? 0),
			firstRiskOn: (asDate(data['firstRiskOn']) ?? new Date(0)).toISOString(),
			latestRiskOn: (asDate(data['latestRiskOn']) ?? new Date(0)).toISOString(),
			latestOutcome: data['latestOutcome'] as 'duplicate-risk' | 'cancelled',
			...(originalCheckInOn ? { originalCheckInOn: originalCheckInOn.toISOString() } : {}),
		};
	}).sort((left, right) => right.latestRiskOn.localeCompare(left.latestRiskOn));
	return { uid: authUser.uid, rawCodePersisted, attempts, summaries };
}

/** Reads queued email QR-path snapshots without exposing confirmation codes. */
export async function inspectQueuedRegistrationEmails(
	emailAddress: string,
): Promise<TestQueuedRegistrationEmailSnapshot[]> {
	const normalizedEmail = emailAddress.toLowerCase();
	const db = admin.firestore();
	const collections = ['tmp_registrationemails', 'tmp_registrationemails2'] as const;
	const snapshots = await Promise.all(collections.map(async (collection) => ({
		collection,
		snapshot: await db.collection(collection).where('email', '==', normalizedEmail).get(),
	})));
	return snapshots.flatMap(({ collection, snapshot }) => snapshot.docs.map((document) => {
		const data = document.data();
		const queuedOn = asDate(data['queuedOn']);
		return {
			id: document.id,
			collection,
			...(typeof data['queueSource'] === 'string' ? { queueSource: data['queueSource'] } : {}),
			...(typeof data['deliveryState'] === 'string' ? { deliveryState: data['deliveryState'] } : {}),
			...(typeof data['qrCodeStoragePath'] === 'string' ? { qrCodeStoragePath: data['qrCodeStoragePath'] } : {}),
			hasConfirmationCode: typeof data['code'] === 'string' && Boolean(data['code']),
			...(queuedOn ? { queuedOn: queuedOn.toISOString() } : {}),
		};
	}));
}

/** Seeds schedule statistics for data-backed reporting E2E cases. */
export async function seedScheduleStats(
	stats: TestScheduleStatsSeed,
): Promise<void> {
	if (!Number.isInteger(stats.programYear)) {
		throw new Error('programYear must be a whole number.');
	}

	const dateTimeCounts = stats.dateTimeCounts.map((entry) => {
		const dateTime = new Date(entry.dateTime);
		if (Number.isNaN(dateTime.getTime())) {
			throw new Error(`Invalid schedule-stat date: ${entry.dateTime}.`);
		}
		if (!Number.isInteger(entry.count) || entry.count < 0) {
			throw new Error('Schedule-stat counts must be non-negative integers.');
		}
		return { dateTime, count: entry.count };
	});

	await admin
		.firestore()
		.collection('stats')
		.doc(`schedule-${stats.programYear}`)
		.set({ dateTimeCounts });
}

/** Seeds the nightly registration statistics document used by reporting E2E cases. */
export async function seedRegistrationStats(
	stats: TestRegistrationStatsSeed,
): Promise<void> {
	const dateTimeCount = stats.dateTimeCount.map((entry) => ({
		...entry,
		dateTime: new Date(entry.dateTime),
	}));
	await admin
		.firestore()
		.collection('stats')
		.doc(`registration-${stats.programYear}`)
		.set({
			completedRegistrations: stats.completedRegistrations,
			dateTimeCount,
			zipCodeCount: stats.zipCodeCount,
		});
}

/** Seeds the aggregated check-in statistics document used by reporting E2E cases. */
export async function seedCheckInStats(
	stats: TestCheckInStatsSeed,
): Promise<void> {
	await admin
		.firestore()
		.collection('stats')
		.doc(`checkin-${stats.programYear}`)
		.set({
			lastUpdated: new Date(stats.lastUpdated),
			dateTimeCount: stats.dateTimeCount,
		});
}

/** Seeds the referral and ZIP statistics document used by reporting E2E cases. */
export async function seedUserStats(stats: TestUserStatsSeed): Promise<void> {
	await admin
		.firestore()
		.collection('stats')
		.doc(`user-${stats.programYear}`)
		.set({
			totalUsers: stats.totalUsers,
			zipCodeCount: stats.zipCodeCount,
			referrerCount: stats.referrerCount,
		});
}

/**
 * Marks an emulator customer registration as checked in for customer E2E tests.
 */
export async function seedCheckInForEmail(
	emailAddress: string,
): Promise<{ uid: string }> {
	const authUser = await admin.auth().getUserByEmail(emailAddress);
	const db = admin.firestore();

	await db.collection('checkins').doc(authUser.uid).set({
		checkInDateTime: new Date(),
		customerId: authUser.uid,
		inStats: false,
		registrationCode: 'E2E-CHECKIN',
	});
	await db
		.collection('registrations')
		.doc(authUser.uid)
		.set({ hasCheckedIn: true }, { merge: true });

	return { uid: authUser.uid };
}

/**
 * Seeds a specific scenario for testing
 * @param scenario - The test scenario name
 */
export async function seedTestScenario(scenario: string): Promise<void> {
	switch (scenario) {
		case 'create-account-enabled':
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
			});
			break;

		case 'create-account-disabled':
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: false,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
			});
			break;

		case 'registration-closed':
			await seedPublicParameters({
				registrationEnabled: false,
				createAccountEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
			});
			break;

		case 'maintenance-mode':
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: true,
				maintenanceModeEnabled: true,
				weatherModeEnabled: false,
			});
			break;

		case 'weather-mode':
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: true,
			});
			break;

		default:
			// Reuse the standard enabled scenario.
			await seedTestScenario('create-account-enabled');
	}
}
