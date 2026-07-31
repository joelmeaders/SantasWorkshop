import { parseAsync } from 'json2csv';
import { getFunctions } from 'firebase-admin/functions';
import {
	COLLECTION_SCHEMA,
	OwnerOperationCounts,
	OwnerOperationResult,
	OwnerOperationType,
	OwnerScheduleSlotInput,
} from '../models';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { FUNCTION_REGION } from '../utility/function-region';
import {
	FIRESTORE_BACKUP_BUCKET,
	SHOP_TIME_ZONE,
} from '../utility/runtime-config';
import {
	assertRecentMarketingExport,
	isOwnerOperationSeasonOpen,
} from './ownerOperations';

const log = createFunctionLogger('ownerOperationWorker');
const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface WorkerRequest {
	operationId: string;
}

interface StoredOperation {
	operation: OwnerOperationType;
	status: 'queued' | 'backing-up' | 'running' | 'succeeded' | 'failed';
	projectId: string;
	programYear?: number;
	slots?: OwnerScheduleSlotInput[];
	actorUid: string;
	counts: OwnerOperationCounts;
	progress: OwnerOperationCounts;
	stage: string;
	backupOperationName?: string;
	backupLocation?: string;
	exportPath?: string;
}

type WorkerResult = OwnerOperationResult & {
	exportPath?: string;
	deferred?: boolean;
};

interface CheckInRecord {
	customerId?: string;
	registrationCode?: string;
	checkInDateTime?: admin.firestore.Timestamp | Date;
	inStats?: boolean;
	stats?: {
		children?: number;
		modifiedAtCheckIn?: boolean;
	};
}

interface CheckInBucket {
	date: number;
	hour: number;
	customerCount: number;
	pregisteredCount: number;
	modifiedCount: number;
	childCount: number;
}

const operationRef = (operationId: string) =>
	admin
		.firestore()
		.collection(COLLECTION_SCHEMA.ownerOperations)
		.doc(operationId);

const updateOperation = async (
	operationId: string,
	update: Record<string, unknown>,
): Promise<void> => {
	await operationRef(operationId).set(
		{ ...update, updatedAt: new Date() },
		{ merge: true },
	);
};

const enqueueContinuation = async (operationId: string): Promise<void> => {
	await getFunctions(admin.app())
		.taskQueue<WorkerRequest>(
			`locations/${FUNCTION_REGION}/functions/ownerOperationWorker`,
		)
		.enqueue(
			{ operationId },
			{ scheduleDelaySeconds: 30 },
		);
};

const releaseLock = async (
	operation: OwnerOperationType,
): Promise<void> => {
	await admin
		.firestore()
		.collection(COLLECTION_SCHEMA.ownerOperationLocks)
		.doc(operation)
		.delete()
		.catch(() => undefined);
};

const toDate = (
	value: admin.firestore.Timestamp | Date | undefined,
): Date | undefined => {
	if (!value) return undefined;
	return value instanceof Date ? value : value.toDate();
};

const localDateParts = (
	date: Date,
): { year: number; day: number; hour: number } => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: SHOP_TIME_ZONE,
		year: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		hourCycle: 'h23',
	}).formatToParts(date);
	const read = (type: Intl.DateTimeFormatPartTypes): number =>
		Number(parts.find((part) => part.type === type)?.value);
	return { year: read('year'), day: read('day'), hour: read('hour') };
};

const executeReminderQueue = async (
	operation: StoredOperation,
): Promise<OwnerOperationResult> => {
	const result = await (
		await import('./queueReminderEmails')
	).default(operation.programYear as number);
	return {
		message: 'Reminder email queue run completed.',
		queued: result.success,
		skipped: Math.max(
			0,
			(operation.counts['eligibleRegistrations'] ?? 0) -
				result.success -
				result.failed,
		),
		failed: result.failed,
	};
};

const cleanupExpiredExports = async (): Promise<void> => {
	const [files] = await admin
		.storage()
		.bucket()
		.getFiles({ prefix: 'owner-exports/' });
	const cutoff = Date.now() - EXPORT_RETENTION_MS;
	await Promise.all(
		files.map(async (file) => {
			const [metadata] = await file.getMetadata();
			const created = Date.parse(metadata.timeCreated ?? '');
			if (Number.isFinite(created) && created < cutoff) {
				await file.delete({ ignoreNotFound: true });
			}
		}),
	);
};

const executeExport = async (
	operationId: string,
	operation: StoredOperation,
): Promise<OwnerOperationResult & { exportPath: string }> => {
	const isMarketing = operation.operation === 'export-marketing-emails';
	let rows: Array<Record<string, unknown>>;
	if (isMarketing) {
		const snapshot = await admin
			.firestore()
			.collection(COLLECTION_SCHEMA.users)
			.where('newsletter', '==', true)
			.get();
		rows = snapshot.docs.map((doc) => doc.data());
	} else {
		const snapshot = await admin
			.firestore()
			.collection(COLLECTION_SCHEMA.registrations)
			.where('programYear', '==', operation.programYear)
			.get();
		rows = snapshot.docs
			.map((doc) => doc.data())
			.filter((record) => Boolean(record['registrationSubmittedOn']));
	}
	const output = await parseAsync(rows, {
		fields: ['emailAddress', 'firstName', 'lastName', 'zipCode'],
	});
	const prefix = isMarketing ? 'marketing' : 'registered';
	const exportPath = `owner-exports/${prefix}/${operationId}.csv`;
	await admin
		.storage()
		.bucket()
		.file(exportPath)
		.save(output, {
			contentType: 'text/csv; charset=utf-8',
			resumable: false,
			metadata: {
				cacheControl: 'private, no-store',
				metadata: {
					expiresAt: new Date(
						Date.now() + EXPORT_RETENTION_MS,
					).toISOString(),
				},
			},
		});
	await cleanupExpiredExports();
	return {
		message: `Created ${rows.length} row export.`,
		rows: rows.length,
		exportAvailable: true,
		exportPath,
	};
};

const executeRepairCheckInFlags =
	async (): Promise<OwnerOperationResult> => {
		const snapshot = await admin
			.firestore()
			.collection(COLLECTION_SCHEMA.checkins)
			.get();
		const writer = admin.firestore().bulkWriter();
		let repaired = 0;
		for (const doc of snapshot.docs) {
			const checkin = doc.data() as CheckInRecord;
			const uid = checkin.customerId ?? doc.id;
			if (!uid || uid === 'onsite') continue;
			const registrationRef = admin
				.firestore()
				.collection(COLLECTION_SCHEMA.registrations)
				.doc(uid);
			const registration = await registrationRef.get();
			if (
				registration.exists &&
				registration.data()?.['hasCheckedIn'] !== true
			) {
				writer.set(
					registrationRef,
					{ hasCheckedIn: true },
					{ merge: true },
				);
				repaired++;
			}
		}
		await writer.close();
		return {
			message: `Repaired ${repaired} registration check-in flags.`,
			repaired,
		};
	};

const executeRebuildCheckInStats = async (
	programYear: number,
): Promise<OwnerOperationResult> => {
	const snapshot = await admin
		.firestore()
		.collection(COLLECTION_SCHEMA.checkins)
		.get();
	const buckets = new Map<string, CheckInBucket>();
	const selected: admin.firestore.DocumentReference[] = [];
	for (const doc of snapshot.docs) {
		const checkin = doc.data() as CheckInRecord;
		const date = toDate(checkin.checkInDateTime);
		if (!date) continue;
		const local = localDateParts(date);
		if (local.year !== programYear) continue;
		selected.push(doc.ref);
		const key = `${local.day}-${local.hour}`;
		const current = buckets.get(key) ?? {
			date: local.day,
			hour: local.hour,
			customerCount: 0,
			pregisteredCount: 0,
			modifiedCount: 0,
			childCount: 0,
		};
		current.customerCount++;
		current.childCount += checkin.stats?.children ?? 0;
		if (checkin.registrationCode !== 'onsite') {
			current.pregisteredCount++;
		}
		if (checkin.stats?.modifiedAtCheckIn) {
			current.modifiedCount++;
		}
		buckets.set(key, current);
	}
	const writer = admin.firestore().bulkWriter();
	for (const ref of selected) {
		writer.set(ref, { inStats: true }, { merge: true });
	}
	writer.set(
		admin
			.firestore()
			.collection(COLLECTION_SCHEMA.stats)
			.doc(`checkin-${programYear}`),
		{
			lastUpdated: new Date(),
			dateTimeCount: Array.from(buckets.values()).sort(
				(left, right) =>
					left.date - right.date || left.hour - right.hour,
			),
		},
		{ merge: false },
	);
	await writer.close();
	return {
		message: `Rebuilt check-in statistics from ${selected.length} records.`,
		records: selected.length,
	};
};

const executeScheduleInitialization = async (
	slots: OwnerScheduleSlotInput[],
): Promise<OwnerOperationResult> => {
	const refs = slots.map((slot) => {
		const stableId = `${slot.programYear}-${slot.dateTime.replaceAll(
			/[^0-9]/g,
			'',
		)}`;
		return admin
			.firestore()
			.collection(COLLECTION_SCHEMA.dateTimeSlots)
			.doc(stableId);
	});
	const snapshots = await admin.firestore().getAll(...refs);
	const writer = admin.firestore().bulkWriter();
	let created = 0;
	snapshots.forEach((snapshot, index) => {
		if (snapshot.exists) return;
		const slot = slots[index];
		writer.create(refs[index], {
			programYear: slot.programYear,
			dateTime: new Date(slot.dateTime),
			maxSlots: slot.maxSlots,
			enabled: slot.enabled,
			slotsReserved: 0,
			lastUpdated: new Date(),
		});
		created++;
	});
	await writer.close();
	return {
		message: `Created ${created} schedules and skipped ${slots.length - created} existing schedules.`,
		created,
		skipped: slots.length - created,
	};
};

const deleteCustomerAuthUsers = async (): Promise<number> => {
	const staffSnapshot = await admin
		.firestore()
		.collection(COLLECTION_SCHEMA.staff)
		.get();
	const staffUids = new Set(staffSnapshot.docs.map((doc) => doc.id));
	const toDelete: string[] = [];
	let pageToken: string | undefined;
	do {
		const page = await admin.auth().listUsers(1000, pageToken);
		for (const user of page.users) {
			const claims = user.customClaims ?? {};
			const roles = claims['roles'];
			const elevated =
				claims['owner'] === true ||
				claims['admin'] === true ||
				(Array.isArray(roles) && roles.length > 0) ||
				staffUids.has(user.uid);
			if (!elevated) toDelete.push(user.uid);
		}
		pageToken = page.pageToken;
	} while (pageToken);
	for (let index = 0; index < toDelete.length; index += 1000) {
		await admin.auth().deleteUsers(toDelete.slice(index, index + 1000));
	}
	return toDelete.length;
};

export const executeYearlyReset = async (
	operationId: string,
	operation: StoredOperation,
): Promise<WorkerResult> => {
	const client = new admin.firestore.v1.FirestoreAdminClient();
	const databaseName = client.databasePath(operation.projectId, '(default)');
	const backupLocation =
		operation.backupLocation ??
		`${FIRESTORE_BACKUP_BUCKET.replace(
			/\/$/,
			'',
		)}/yearly-reset/${operation.programYear}/${operationId}`;
	if (!operation.backupOperationName) {
		await updateOperation(operationId, {
			status: 'backing-up',
			stage: 'starting-backup',
			backupLocation,
		});
		const [backupOperation] = await client.exportDocuments({
			name: databaseName,
			outputUriPrefix: backupLocation,
			collectionIds: [],
		});
		if (!backupOperation.name) {
			throw new Error(
				'Firestore did not return a backup operation name.',
			);
		}
		await updateOperation(operationId, {
			backupOperationName: backupOperation.name,
			stage: 'waiting-for-backup',
		});
		await enqueueContinuation(operationId);
		return {
			message: 'Firestore backup started.',
			deferred: true,
		};
	}

	const [backupOperation] = await client.operationsClient.getOperation({
		name: operation.backupOperationName,
	});
	if (backupOperation.error) {
		throw new Error(
			`Firestore backup failed: ${backupOperation.error.message ?? 'unknown error'}`,
		);
	}
	if (!backupOperation.done) {
		await updateOperation(operationId, {
			status: 'backing-up',
			stage: 'waiting-for-backup',
		});
		await enqueueContinuation(operationId);
		return {
			message: 'Firestore backup is still running.',
			deferred: true,
		};
	}

	await updateOperation(operationId, {
		status: 'running',
		stage: 'purging-firestore',
	});
	const collections = [
		COLLECTION_SCHEMA.users,
		COLLECTION_SCHEMA.registrations,
		COLLECTION_SCHEMA.registrationSearchIndex,
		COLLECTION_SCHEMA.children,
		COLLECTION_SCHEMA.checkins,
		COLLECTION_SCHEMA.editedRegistrations,
		COLLECTION_SCHEMA.onSiteRegistrations,
		COLLECTION_SCHEMA.tmpRegistrationEmails,
		COLLECTION_SCHEMA.tmpResendRegistrationEmails,
		COLLECTION_SCHEMA.dateTimeSlots,
	];
	const progress: OwnerOperationCounts = { ...(operation.progress ?? {}) };
	for (const collection of collections) {
		const stageKey = `firestore:${collection}`;
		if (progress[stageKey] === 1) continue;
		await admin
			.firestore()
			.recursiveDelete(admin.firestore().collection(collection));
		progress[stageKey] = 1;
		await updateOperation(operationId, {
			stage: `purged-${collection}`,
			progress,
		});
	}
	let deletedAuthUsers = progress['deletedAuthUsers'] ?? 0;
	if (progress['authComplete'] !== 1) {
		deletedAuthUsers = await deleteCustomerAuthUsers();
		progress['deletedAuthUsers'] = deletedAuthUsers;
		progress['authComplete'] = 1;
	}
	await updateOperation(operationId, {
		stage: 'purging-registration-qrs',
		progress,
	});
	let deletedQrImages = progress['deletedQrImages'] ?? 0;
	if (progress['qrComplete'] !== 1) {
		const [qrFiles] = await admin
			.storage()
			.bucket()
			.getFiles({ prefix: 'registrations/' });
		await Promise.all(
			qrFiles.map((file) => file.delete({ ignoreNotFound: true })),
		);
		deletedQrImages = qrFiles.length;
		progress['deletedQrImages'] = deletedQrImages;
		progress['qrComplete'] = 1;
		await updateOperation(operationId, { progress });
	}
	return {
		message: 'Yearly reset completed after a verified Firestore backup.',
		deletedAuthUsers,
		deletedQrImages,
		backupLocation,
	};
};

const executeOperation = async (
	operationId: string,
	operation: StoredOperation,
): Promise<WorkerResult> => {
	switch (operation.operation) {
		case 'queue-reminder-emails':
			return executeReminderQueue(operation);
		case 'export-marketing-emails':
		case 'export-registered-emails':
			return executeExport(operationId, operation);
		case 'repair-checkin-flags':
			return executeRepairCheckInFlags();
		case 'rebuild-checkin-stats':
			return executeRebuildCheckInStats(operation.programYear as number);
		case 'initialize-schedule':
			return executeScheduleInitialization(operation.slots ?? []);
		case 'yearly-reset':
			return executeYearlyReset(operationId, operation);
	}
};

export default async function ownerOperationWorker(
	request: { data: WorkerRequest },
): Promise<void> {
	const operationId = request.data.operationId;
	const snapshot = await operationRef(operationId).get();
	if (!snapshot.exists) {
		throw new Error(`Owner operation ${operationId} does not exist.`);
	}
	const operation = snapshot.data() as StoredOperation;
	if (operation.status === 'succeeded') {
		await releaseLock(operation.operation);
		return;
	}
	let shouldReleaseLock = true;
	try {
		if (
			[
				'yearly-reset',
				'rebuild-checkin-stats',
				'initialize-schedule',
			].includes(operation.operation) &&
			!isOwnerOperationSeasonOpen()
		) {
			throw new Error(
				'The owner-operation execution window closed before work began.',
			);
		}
		if (operation.operation === 'yearly-reset') {
			await assertRecentMarketingExport();
		}
		await updateOperation(operationId, {
			status: 'running',
			stage: 'running',
		});
		const result = await executeOperation(operationId, operation);
		const { exportPath, deferred, ...publicResult } = result;
		if (deferred) {
			shouldReleaseLock = false;
			return;
		}
		await updateOperation(operationId, {
			status: 'succeeded',
			stage: 'completed',
			result: publicResult,
			...(exportPath ? { exportPath } : {}),
			completedAt: new Date(),
		});
		log.info('Owner operation completed', {
			operationId,
			operation: operation.operation,
		});
	} catch (error) {
		log.error(
			'Owner operation failed',
			{ operationId, operation: operation.operation },
			error,
		);
		await updateOperation(operationId, {
			status: 'failed',
			stage: 'failed',
			errorMessage:
				error instanceof Error
					? error.message
					: 'Owner operation failed.',
			completedAt: new Date(),
		});
		throw error;
	} finally {
		if (shouldReleaseLock) {
			await releaseLock(operation.operation);
		}
	}
}
