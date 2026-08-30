export const OWNER_OPERATION_TYPES = [
	'queue-reminder-emails',
	'export-marketing-emails',
	'export-registered-emails',
	'rebuild-checkin-stats',
	'repair-checkin-flags',
	'initialize-schedule',
	'yearly-reset',
] as const;

export type OwnerOperationType = (typeof OWNER_OPERATION_TYPES)[number];

export type OwnerOperationStatus =
	| 'queued'
	| 'backing-up'
	| 'running'
	| 'succeeded'
	| 'failed';

export interface OwnerScheduleSlotInput {
	programYear: number;
	dateTime: string;
	maxSlots: number;
	enabled: boolean;
}

export interface PreviewOwnerOperationRequest {
	operation: OwnerOperationType;
	programYear?: number;
	slots?: OwnerScheduleSlotInput[];
}

export type OwnerOperationCounts = Record<string, number>;

export interface PreviewOwnerOperationResponse {
	previewId: string;
	operation: OwnerOperationType;
	projectId: string;
	programYear?: number;
	expiresAt: string;
	confirmationPhrase: string;
	counts: OwnerOperationCounts;
	seasonRestricted: boolean;
}

export interface StartOwnerOperationRequest {
	previewId: string;
	confirmationPhrase: string;
}

export interface StartOwnerOperationResponse {
	operationId: string;
	status: OwnerOperationStatus;
}

export interface GetOwnerOperationRequest {
	operationId: string;
}

export interface OwnerOperationResult {
	message?: string;
	exportAvailable?: boolean;
	[key: string]: boolean | number | string | undefined;
}

export interface OwnerOperation {
	id: string;
	operation: OwnerOperationType;
	status: OwnerOperationStatus;
	projectId: string;
	programYear?: number;
	actorUid: string;
	stage?: string;
	counts: OwnerOperationCounts;
	progress: OwnerOperationCounts;
	result?: OwnerOperationResult;
	errorMessage?: string;
	createdAt: string;
	updatedAt: string;
	completedAt?: string;
	backupOperationName?: string;
	backupLocation?: string;
}

export interface GetOwnerExportUrlResponse {
	url: string;
	expiresAt: string;
}
