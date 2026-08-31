import { getFunctions } from 'firebase-admin/functions';
import {
	HttpsError,
	type CallableRequest,
} from 'firebase-functions/v2/https';
import {
	COLLECTION_SCHEMA,
	GetOwnerExportUrlResponse,
	GetOwnerOperationRequest,
	OWNER_OPERATION_TYPES,
	OwnerOperation,
	OwnerOperationCounts,
	OwnerOperationType,
	OwnerScheduleSlotInput,
	PreviewOwnerOperationRequest,
	PreviewOwnerOperationResponse,
	StartOwnerOperationRequest,
	StartOwnerOperationResponse,
} from '../models';
import admin from '../firebase-admin';
import {
	requireOwner,
	requireRecentAuthentication,
} from '../utility/capabilities';
import { createFunctionLogger } from '../utility/observability';
import { FUNCTION_REGION } from '../utility/function-region';
import { SHOP_TIME_ZONE } from '../utility/runtime-config';

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const EXPORT_URL_TTL_MS = 15 * 60 * 1000;
const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SCHEDULE_SLOTS = 250;
const log = createFunctionLogger('ownerOperations');

interface StoredPreview {
	actorUid: string;
	operation: OwnerOperationType;
	projectId: string;
	programYear?: number;
	slots?: OwnerScheduleSlotInput[];
	counts: OwnerOperationCounts;
	confirmationPhrase: string;
	seasonRestricted: boolean;
	expiresAt: Date | admin.firestore.Timestamp;
	consumedAt?: Date | admin.firestore.Timestamp;
}

interface StoredOperation {
	operation: OwnerOperationType;
	status: OwnerOperation['status'];
	projectId: string;
	programYear?: number;
	slots?: OwnerScheduleSlotInput[];
	actorUid: string;
	counts: OwnerOperationCounts;
	progress: OwnerOperationCounts;
	stage: string;
	createdAt: Date | admin.firestore.Timestamp;
	updatedAt: Date | admin.firestore.Timestamp;
	completedAt?: Date | admin.firestore.Timestamp;
	result?: OwnerOperation['result'];
	errorMessage?: string;
	backupOperationName?: string;
	backupLocation?: string;
	exportPath?: string;
}

const projectId = (): string => {
	const value =
		admin.app().options.projectId ??
		process.env['GCLOUD_PROJECT'] ??
		process.env['GCP_PROJECT'];
	if (!value) {
		throw new HttpsError(
			'internal',
			'Unable to determine the Firebase project.',
		);
	}
	return value;
};

const localDateParts = (
	date: Date,
): { year: number; month: number; day: number } => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: SHOP_TIME_ZONE,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes): number =>
		Number(parts.find((part) => part.type === type)?.value);
	return {
		year: value('year'),
		month: value('month'),
		day: value('day'),
	};
};

export const isOwnerOperationSeasonOpen = (now = new Date()): boolean => {
	const { month, day } = localDateParts(now);
	return month < 9 || (month === 9 && day <= 15);
};

const isSeasonRestricted = (operation: OwnerOperationType): boolean =>
	operation === 'yearly-reset' ||
	operation === 'rebuild-checkin-stats' ||
	operation === 'initialize-schedule';

const assertSeasonOpen = (operation: OwnerOperationType, now: Date): void => {
	if (isSeasonRestricted(operation) && !isOwnerOperationSeasonOpen(now)) {
		throw new HttpsError(
			'failed-precondition',
			'This operation is available only from January 1 through September 15.',
		);
	}
};

const assertKnownOperation = (value: unknown): OwnerOperationType => {
	if (
		typeof value !== 'string' ||
		!OWNER_OPERATION_TYPES.includes(value as OwnerOperationType)
	) {
		throw new HttpsError('invalid-argument', 'Unknown owner operation.');
	}
	return value as OwnerOperationType;
};

const requireProgramYear = (
	operation: OwnerOperationType,
	value: unknown,
	now: Date,
): number | undefined => {
	const needsYear =
		operation !== 'export-marketing-emails' &&
		operation !== 'repair-checkin-flags';
	if (!needsYear && value === undefined) {
		return undefined;
	}
	if (
		typeof value !== 'number' ||
		!Number.isInteger(value) ||
		value < 2000 ||
		value > localDateParts(now).year + 1
	) {
		throw new HttpsError(
			'invalid-argument',
			'A valid program year is required.',
		);
	}
	if (
		operation === 'yearly-reset' &&
		value !== localDateParts(now).year - 1
	) {
		throw new HttpsError(
			'failed-precondition',
			'The yearly reset must target the previous calendar year.',
		);
	}
	if (
		operation === 'initialize-schedule' &&
		value !== localDateParts(now).year
	) {
		throw new HttpsError(
			'failed-precondition',
			'Schedule initialization must target the current calendar year.',
		);
	}
	return value;
};

const validateSlots = (
	operation: OwnerOperationType,
	value: unknown,
	programYear: number | undefined,
): OwnerScheduleSlotInput[] | undefined => {
	if (operation !== 'initialize-schedule') {
		if (value !== undefined) {
			throw new HttpsError(
				'invalid-argument',
				'Schedule slots are not accepted for this operation.',
			);
		}
		return undefined;
	}
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.length > MAX_SCHEDULE_SLOTS
	) {
		throw new HttpsError(
			'invalid-argument',
			`Schedule initialization requires 1-${MAX_SCHEDULE_SLOTS} slots.`,
		);
	}
	return value.map((candidate: unknown) => {
		if (
			typeof candidate !== 'object' ||
			candidate === null ||
			Array.isArray(candidate)
		) {
			throw new HttpsError('invalid-argument', 'Invalid schedule slot.');
		}
		const slot = candidate as Record<string, unknown>;
		const allowedKeys = new Set([
			'programYear',
			'dateTime',
			'maxSlots',
			'enabled',
		]);
		if (Object.keys(slot).some((key) => !allowedKeys.has(key))) {
			throw new HttpsError(
				'invalid-argument',
				'Schedule slot contains unsupported fields.',
			);
		}
		const date = new Date(String(slot['dateTime']));
		if (
			slot['programYear'] !== programYear ||
			Number.isNaN(date.valueOf()) ||
			date.getFullYear() !== programYear ||
			!Number.isInteger(slot['maxSlots']) ||
			Number(slot['maxSlots']) < 0 ||
			typeof slot['enabled'] !== 'boolean'
		) {
			throw new HttpsError(
				'invalid-argument',
				'Schedule slot values are invalid.',
			);
		}
		return {
			programYear: programYear as number,
			dateTime: date.toISOString(),
			maxSlots: Number(slot['maxSlots']),
			enabled: slot['enabled'],
		};
	});
};

const parsePreviewRequest = (
	data: unknown,
	now: Date,
): {
	operation: OwnerOperationType;
	programYear?: number;
	slots?: OwnerScheduleSlotInput[];
} => {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		throw new HttpsError('invalid-argument', 'Request data must be an object.');
	}
	const record = data as Record<string, unknown>;
	const allowedKeys = new Set(['operation', 'programYear', 'slots']);
	if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
		throw new HttpsError(
			'invalid-argument',
			'Request contains unsupported fields.',
		);
	}
	const operation = assertKnownOperation(record['operation']);
	const programYear = requireProgramYear(
		operation,
		record['programYear'],
		now,
	);
	const slots = validateSlots(operation, record['slots'], programYear);
	assertSeasonOpen(operation, now);
	return { operation, programYear, slots };
};

const countCollection = async (name: string): Promise<number> => {
	const snapshot = await admin
		.firestore()
		.collection(name)
		.count()
		.get();
	return snapshot.data().count;
};

const isElevatedAuthUser = (user: admin.auth.UserRecord): boolean => {
	const claims = user.customClaims ?? {};
	const roles = claims['roles'];
	return (
		claims['owner'] === true ||
		claims['admin'] === true ||
		(Array.isArray(roles) && roles.length > 0)
	);
};

const countCustomerAuthUsers = async (): Promise<number> => {
	let count = 0;
	let pageToken: string | undefined;
	do {
		const page = await admin.auth().listUsers(1000, pageToken);
		count += page.users.filter((user) => !isElevatedAuthUser(user)).length;
		pageToken = page.pageToken;
	} while (pageToken);
	return count;
};

const countRegistrationQrs = async (): Promise<number> => {
	const [files] = await admin
		.storage()
		.bucket()
		.getFiles({ prefix: 'registrations/' });
	return files.length;
};

const loadRegistrationsForYear = async (
	programYear: number,
): Promise<Array<Record<string, unknown>>> => {
	const snapshot = await admin
		.firestore()
		.collection(COLLECTION_SCHEMA.registrations)
		.where('programYear', '==', programYear)
		.get();
	return snapshot.docs.map((doc) => doc.data());
};

const reminderEligible = (record: Record<string, unknown>): boolean =>
	Boolean(record['registrationSubmittedOn']) &&
	!record['reminderEmailSentOn'] &&
	!record['reminderEmailQueuedOn'] &&
	Boolean(record['qrCodeGeneratedOn']) &&
	!record['qrCodeGenerationFailedOn'];

const buildCounts = async (
	operation: OwnerOperationType,
	programYear: number | undefined,
	slots: OwnerScheduleSlotInput[] | undefined,
): Promise<OwnerOperationCounts> => {
	switch (operation) {
		case 'queue-reminder-emails': {
			const registrations = await loadRegistrationsForYear(
				programYear as number,
			);
			return {
				eligibleRegistrations:
					registrations.filter(reminderEligible).length,
			};
		}
		case 'export-marketing-emails':
			return {
				users: await admin
					.firestore()
					.collection(COLLECTION_SCHEMA.users)
					.where('newsletter', '==', true)
					.count()
					.get()
					.then((snapshot) => snapshot.data().count),
			};
		case 'export-registered-emails':
			return {
				registrations: (
					await loadRegistrationsForYear(programYear as number)
				).filter((record) => Boolean(record['registrationSubmittedOn']))
					.length,
			};
		case 'rebuild-checkin-stats':
		case 'repair-checkin-flags':
			return {
				checkins: await countCollection(COLLECTION_SCHEMA.checkins),
			};
		case 'initialize-schedule':
			return { requestedSlots: slots?.length ?? 0 };
		case 'yearly-reset':
			return {
				authUsers: await countCustomerAuthUsers(),
				users: await countCollection(COLLECTION_SCHEMA.users),
				registrations: await countCollection(
					COLLECTION_SCHEMA.registrations,
				),
				registrationSearchIndex: await countCollection(
					COLLECTION_SCHEMA.registrationSearchIndex,
				),
				children: await countCollection(COLLECTION_SCHEMA.children),
				checkins: await countCollection(COLLECTION_SCHEMA.checkins),
				cancellations: await countCollection(COLLECTION_SCHEMA.cancellations),
				registrationScanAttempts: await countCollection(
					COLLECTION_SCHEMA.registrationScanAttempts,
				),
				registrationScanRiskSummaries: await countCollection(
					COLLECTION_SCHEMA.registrationScanRiskSummaries,
				),
				editedRegistrations: await countCollection(
					COLLECTION_SCHEMA.editedRegistrations,
				),
				onSiteRegistrations: await countCollection(
					COLLECTION_SCHEMA.onSiteRegistrations,
				),
				emailQueue: await countCollection(
					COLLECTION_SCHEMA.tmpRegistrationEmails,
				),
				resendEmailQueue: await countCollection(
					COLLECTION_SCHEMA.tmpResendRegistrationEmails,
				),
				dateTimeSlots: await countCollection(
					COLLECTION_SCHEMA.dateTimeSlots,
				),
				qrImages: await countRegistrationQrs(),
			};
	}
};

export const assertRecentMarketingExport = async (
	now = new Date(),
): Promise<void> => {
	const snapshot = await admin
		.firestore()
		.collection(COLLECTION_SCHEMA.ownerOperations)
		.where('operation', '==', 'export-marketing-emails')
		.get();
	const cutoff = now.getTime() - EXPORT_RETENTION_MS;
	const candidates = snapshot.docs
		.map((doc) => doc.data() as StoredOperation)
		.filter(
			(operation) =>
				operation.status === 'succeeded' &&
				!!operation.exportPath &&
				toDate(
					operation.completedAt ?? operation.updatedAt,
				).getTime() >= cutoff,
		);
	for (const candidate of candidates) {
		const [exists] = await admin
			.storage()
			.bucket()
			.file(candidate.exportPath as string)
			.exists();
		if (exists) return;
	}
	throw new HttpsError(
		'failed-precondition',
		'Create a marketing email export before starting the yearly reset.',
	);
};

const confirmationPhrase = (
	operation: OwnerOperationType,
	targetProjectId: string,
	programYear?: number,
): string =>
	[
		operation.toUpperCase().replaceAll('-', ' '),
		targetProjectId,
		programYear?.toString(),
	]
		.filter(Boolean)
		.join(' ');

const toDate = (value: Date | admin.firestore.Timestamp): Date =>
	value instanceof Date ? value : value.toDate();

const toIso = (
	value: Date | admin.firestore.Timestamp | undefined,
): string | undefined => (value ? toDate(value).toISOString() : undefined);

const parseOperationIdRequest = (data: unknown): string => {
	if (
		typeof data !== 'object' ||
		data === null ||
		Array.isArray(data) ||
		Object.keys(data).some((key) => key !== 'operationId')
	) {
		throw new HttpsError(
			'invalid-argument',
			'Request must contain only an operation ID.',
		);
	}
	const operationId = (data as Record<string, unknown>)['operationId'];
	if (typeof operationId !== 'string' || !operationId.trim()) {
		throw new HttpsError('invalid-argument', 'Operation ID is required.');
	}
	return operationId.trim();
};

export async function previewOwnerOperation(
	request: CallableRequest<PreviewOwnerOperationRequest>,
	now = new Date(),
): Promise<PreviewOwnerOperationResponse> {
	const actor = requireOwner(request);
	const parsed = parsePreviewRequest(request.data, now);
	if (parsed.operation === 'yearly-reset') {
		await assertRecentMarketingExport(now);
	}
	const targetProjectId = projectId();
	const counts = await buildCounts(
		parsed.operation,
		parsed.programYear,
		parsed.slots,
	);
	const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);
	const phrase = confirmationPhrase(
		parsed.operation,
		targetProjectId,
		parsed.programYear,
	);
	const previewRef = admin
		.firestore()
		.collection(COLLECTION_SCHEMA.ownerOperationPreviews)
		.doc();
	const preview: StoredPreview = {
		actorUid: actor.uid,
		operation: parsed.operation,
		projectId: targetProjectId,
		...(parsed.programYear !== undefined
			? { programYear: parsed.programYear }
			: {}),
		...(parsed.slots ? { slots: parsed.slots } : {}),
		counts,
		confirmationPhrase: phrase,
		seasonRestricted: isSeasonRestricted(parsed.operation),
		expiresAt,
	};
	await previewRef.create(preview);
	return {
		previewId: previewRef.id,
		operation: parsed.operation,
		projectId: targetProjectId,
		...(parsed.programYear !== undefined
			? { programYear: parsed.programYear }
			: {}),
		expiresAt: expiresAt.toISOString(),
		confirmationPhrase: phrase,
		counts,
		seasonRestricted: preview.seasonRestricted,
	};
}

export async function startOwnerOperation(
	request: CallableRequest<StartOwnerOperationRequest>,
	now = new Date(),
): Promise<StartOwnerOperationResponse> {
	const actor = requireOwner(request);
	requireRecentAuthentication(actor.token, now);
	if (
		typeof request.data !== 'object' ||
		request.data === null ||
		Array.isArray(request.data) ||
		Object.keys(request.data).some(
			(key) => !['previewId', 'confirmationPhrase'].includes(key),
		)
	) {
		throw new HttpsError('invalid-argument', 'Invalid start request.');
	}
	const previewId = request.data.previewId?.trim();
	const suppliedPhrase = request.data.confirmationPhrase?.trim();
	if (!previewId || !suppliedPhrase) {
		throw new HttpsError(
			'invalid-argument',
			'Preview ID and confirmation phrase are required.',
		);
	}
	const db = admin.firestore();
	const previewRef = db
		.collection(COLLECTION_SCHEMA.ownerOperationPreviews)
		.doc(previewId);
	const operationRef = db
		.collection(COLLECTION_SCHEMA.ownerOperations)
		.doc();
	let operationType: OwnerOperationType = 'yearly-reset';
	await db.runTransaction(async (transaction) => {
		const previewSnapshot = await transaction.get(previewRef);
		if (!previewSnapshot.exists) {
			throw new HttpsError('not-found', 'Operation preview not found.');
		}
		const preview = previewSnapshot.data() as StoredPreview;
		operationType = preview.operation;
		if (
			preview.actorUid !== actor.uid ||
			preview.projectId !== projectId()
		) {
			throw new HttpsError(
				'permission-denied',
				'This preview belongs to a different owner or project.',
			);
		}
		if (preview.consumedAt) {
			throw new HttpsError(
				'already-exists',
				'This operation preview was already used.',
			);
		}
		if (toDate(preview.expiresAt).getTime() <= now.getTime()) {
			throw new HttpsError(
				'deadline-exceeded',
				'This operation preview has expired.',
			);
		}
		if (preview.confirmationPhrase !== suppliedPhrase) {
			throw new HttpsError(
				'invalid-argument',
				'Confirmation phrase does not match.',
			);
		}
		assertSeasonOpen(preview.operation, now);
		const lockRef = db
			.collection(COLLECTION_SCHEMA.ownerOperationLocks)
			.doc(preview.operation);
		const lockSnapshot = await transaction.get(lockRef);
		if (lockSnapshot.exists) {
			throw new HttpsError(
				'aborted',
				'Another operation of this type is already active.',
			);
		}
		const operation: StoredOperation = {
			operation: preview.operation,
			status: 'queued',
			projectId: preview.projectId,
			...(preview.programYear !== undefined
				? { programYear: preview.programYear }
				: {}),
			...(preview.slots ? { slots: preview.slots } : {}),
			actorUid: actor.uid,
			counts: preview.counts,
			progress: {},
			stage: 'queued',
			createdAt: now,
			updatedAt: now,
		};
		transaction.create(operationRef, operation);
		transaction.create(lockRef, {
			operationId: operationRef.id,
			createdAt: now,
		});
		transaction.update(previewRef, { consumedAt: now });
	});
	try {
		await getFunctions(admin.app())
			.taskQueue<{ operationId: string }>(
				`locations/${FUNCTION_REGION}/functions/ownerOperationWorker`,
			)
			.enqueue({ operationId: operationRef.id });
	} catch (error) {
		log.error(
			'Failed to enqueue owner operation',
			{ operationId: operationRef.id, operation: operationType },
			error,
		);
		await Promise.all([
			operationRef.set(
				{
					status: 'failed',
					stage: 'enqueue-failed',
					errorMessage: 'Unable to enqueue the operation.',
					updatedAt: new Date(),
					completedAt: new Date(),
				},
				{ merge: true },
			),
			db
				.collection(COLLECTION_SCHEMA.ownerOperationLocks)
				.doc(operationType)
				.delete(),
		]);
		throw new HttpsError('internal', 'Unable to enqueue the operation.');
	}
	return { operationId: operationRef.id, status: 'queued' };
}

export async function getOwnerOperation(
	request: CallableRequest<GetOwnerOperationRequest>,
): Promise<OwnerOperation> {
	requireOwner(request);
	const operationId = parseOperationIdRequest(request.data);
	const snapshot = await admin
		.firestore()
		.collection(COLLECTION_SCHEMA.ownerOperations)
		.doc(operationId)
		.get();
	if (!snapshot.exists) {
		throw new HttpsError('not-found', 'Owner operation not found.');
	}
	const data = snapshot.data() as StoredOperation;
	return {
		id: snapshot.id,
		operation: data.operation,
		status: data.status,
		projectId: data.projectId,
		...(data.programYear !== undefined
			? { programYear: data.programYear }
			: {}),
		actorUid: data.actorUid,
		stage: data.stage,
		counts: data.counts ?? {},
		progress: data.progress ?? {},
		...(data.result ? { result: data.result } : {}),
		...(data.errorMessage ? { errorMessage: data.errorMessage } : {}),
		createdAt: toIso(data.createdAt) as string,
		updatedAt: toIso(data.updatedAt) as string,
		...(data.completedAt
			? { completedAt: toIso(data.completedAt) }
			: {}),
		...(data.backupOperationName
			? { backupOperationName: data.backupOperationName }
			: {}),
		...(data.backupLocation
			? { backupLocation: data.backupLocation }
			: {}),
	};
}

export async function getOwnerExportUrl(
	request: CallableRequest<GetOwnerOperationRequest>,
	now = new Date(),
): Promise<GetOwnerExportUrlResponse> {
	requireOwner(request);
	const operationId = parseOperationIdRequest(request.data);
	const snapshot = await admin
		.firestore()
		.collection(COLLECTION_SCHEMA.ownerOperations)
		.doc(operationId)
		.get();
	const operation = snapshot.data() as StoredOperation | undefined;
	if (
		!operation ||
		operation.status !== 'succeeded' ||
		!operation.exportPath
	) {
		throw new HttpsError(
			'failed-precondition',
			'This operation does not have a completed export.',
		);
	}
	const expiresAt = new Date(now.getTime() + EXPORT_URL_TTL_MS);
	const [url] = await admin
		.storage()
		.bucket()
		.file(operation.exportPath)
		.getSignedUrl({ action: 'read', expires: expiresAt });
	return { url, expiresAt: expiresAt.toISOString() };
}
