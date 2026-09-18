export const WAITING_LIST_REMOTE_CONFIG_KEY = 'santashop_waiting_list';

export interface WaitingListSettings {
	joiningEnabled: boolean;
	emailSendingEnabled: boolean;
}

export const defaultWaitingListSettings = (): WaitingListSettings => ({
	joiningEnabled: false,
	emailSendingEnabled: false,
});

/** Missing controls are disabled. Invalid controls never grant permission. */
export const parseWaitingListSettings = (
	value: unknown,
): WaitingListSettings => {
	if (value === undefined) return defaultWaitingListSettings();
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Waiting list settings must be an object.');
	const record = value as Record<string, unknown>;
	if (
		Object.keys(record).some(
			(key) => !['joiningEnabled', 'emailSendingEnabled'].includes(key),
		) ||
		typeof record['joiningEnabled'] !== 'boolean' ||
		typeof record['emailSendingEnabled'] !== 'boolean'
	)
		throw new Error('Waiting list settings require two boolean controls.');
	return {
		joiningEnabled: record['joiningEnabled'],
		emailSendingEnabled: record['emailSendingEnabled'],
	};
};

export type WaitingListSource =
	'overview' | 'maintenance' | 'weather' | 'registration-closed';
export const WAITING_LIST_SOURCES: readonly WaitingListSource[] = [
	'overview',
	'maintenance',
	'weather',
	'registration-closed',
];

export interface WaitingListMembership {
	active: boolean;
	joinedOn: Date;
	source: WaitingListSource;
	/** Identifies this opt-in, so leaving and rejoining cannot revive an older campaign. */
	membershipId: string;
}

export interface WaitingListState {
	active: boolean;
	canJoin: boolean;
	reason:
		| 'eligible'
		| 'joined'
		| 'disabled'
		| 'registered'
		| 'appointment-selected'
		| 'capacity-available'
		| 'account-unavailable';
}

export interface SetWaitingListMembershipRequest {
	active: boolean;
	mutationId: string;
	source?: WaitingListSource;
}

export interface WaitingListSettingsResponse {
	settings: WaitingListSettings;
	etag: string;
	version: string;
}

export interface PublishWaitingListSettingsRequest {
	settings: WaitingListSettings;
	expectedEtag: string;
}

export interface WaitingListEmailPreview {
	language: 'en' | 'es';
	templateKey: string;
	revisionId: string;
	subject: string;
	html: string;
	text: string;
}

export interface WaitingListCampaignPreview {
	memberCount: number;
	canSend: boolean;
	blockedReasons: string[];
	emails: WaitingListEmailPreview[];
}

export type WaitingListDeliveryState =
	'sending' | 'accepted' | 'skipped' | 'failed' | 'uncertain';
export interface WaitingListCampaign {
	simulated?: boolean;
	id: string;
	programYear: number;
	status: 'queued' | 'running' | 'paused' | 'completed' | 'failed';
	createdAt: string;
	updatedAt: string;
	memberCount: number;
	accepted: number;
	skipped: number;
	failed: number;
	uncertain: number;
	message?: string;
}

export interface StartWaitingListCampaignRequest {
	mutationId: string;
	/** The reviewed revisions must still be published when the campaign starts. */
	revisions: Record<'en' | 'es', { templateKey: string; revisionId: string }>;
}

export interface WaitingListCampaignRequest {
	campaignId: string;
}
