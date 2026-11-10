import { HttpsError } from 'firebase-functions/v2/https';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createDefaultPublicParameters,
	type PublicParameters,
} from '../../../src/models';
import { createCallableRequest } from '../../helpers/callable-context';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

const openSettings = (): ReturnType<typeof createDefaultPublicParameters> => {
	const defaults = createDefaultPublicParameters();
	return {
		...defaults,
		createAccountEnabled: true,
		registrationEnabled: true,
		maintenanceModeEnabled: false,
		weatherModeEnabled: false,
		admin: { ...defaults.admin, preRegistrationEnabled: true },
	};
};

const getPublicParameters = vi.fn();
const getPublicParametersForMutation = vi.fn();
const enqueue = vi.fn();
const campaignId = 'settings-campaign';
const campaignPath = `waitingListCampaigns/${campaignId}`;
const emails = (['en', 'es'] as const).map((language) => ({
	language,
	templateKey: `capacity-${language}`,
	revisionId: 'revision-1',
	subject: 'Capacity available',
	html: '<p>Capacity available</p>',
	text: 'Capacity available',
}));
const startRequest = () =>
	createCallableRequest(
		{
			mutationId: campaignId,
			revisions: Object.fromEntries(
				emails.map(({ language, templateKey, revisionId }) => [
					language,
					{ templateKey, revisionId },
				]),
			),
		},
		{ owner: true },
	);

describe('waiting-list campaign public settings', () => {
	let adminMock: ReturnType<typeof createBackgroundAdminMock>;
	let handlers: typeof import('../../../src/fn/waitingListCampaigns');

	beforeEach(async () => {
		vi.resetModules();
		vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
		adminMock = createBackgroundAdminMock();
		adminMock.setCollectionCount('registrations', 1);
		adminMock.setCollectionCount(`${campaignPath}/deliveries`, 0);
		const ref = adminMock.getDocRef(campaignPath);
		Object.assign(ref, {
			collection: (path: string) =>
				adminMock.getCollectionRef(`${campaignPath}/${path}`),
		});
		ref.create.mockImplementation(
			async (record: Record<string, unknown>): Promise<void> => {
				adminMock.setDocSnapshot(campaignPath, record);
			},
		);
		getPublicParameters.mockResolvedValue(openSettings());
		getPublicParametersForMutation.mockResolvedValue(openSettings());
		enqueue.mockResolvedValue(undefined);
		vi.doMock('firebase-admin', () => ({
			...adminMock.module,
			app: vi.fn(),
		}));
		vi.doMock('firebase-admin/functions', () => ({
			getFunctions: () => ({ taskQueue: () => ({ enqueue }) }),
		}));
		vi.doMock('../../../src/utility/public-parameters', () => ({
			getPublicParameters,
			getPublicParametersForMutation,
		}));
		vi.doMock('../../../src/utility/waiting-list-settings', () => ({
			getWaitingListSettings: async () => ({ emailSendingEnabled: true }),
		}));
		vi.doMock('../../../src/utility/waiting-list-email', () => ({
			waitingListSendingAllowed: async () => true,
			loadWaitingListEmails: async () => emails,
			waitingListSendRate: async () => 1,
		}));
		vi.doMock('../../../src/fn/waitingList', () => ({
			hasWaitingListCapacity: async () => true,
		}));
		handlers = await import('../../../src/fn/waitingListCampaigns');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		for (const path of [
			'firebase-admin',
			'firebase-admin/functions',
			'../../../src/utility/public-parameters',
			'../../../src/utility/waiting-list-settings',
			'../../../src/utility/waiting-list-email',
			'../../../src/fn/waitingList',
		])
			vi.doUnmock(path);
	});

	const expectNoCampaignWrites = (): void => {
		expect(adminMock.getDocRef(campaignPath).create).not.toHaveBeenCalled();
		expect(adminMock.getDocRef(campaignPath).update).not.toHaveBeenCalled();
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(enqueue).not.toHaveBeenCalled();
	};

	it('keeps read-only preview on cached settings', async () => {
		getPublicParametersForMutation.mockRejectedValue(
			new HttpsError('unavailable', 'Settings unavailable'),
		);
		await expect(
			handlers.previewWaitingListCampaign(
				createCallableRequest({}, { owner: true }),
			),
		).resolves.toMatchObject({ canSend: true, memberCount: 1 });
		expect(getPublicParameters).toHaveBeenCalledOnce();
		expect(getPublicParametersForMutation).not.toHaveBeenCalled();
		expectNoCampaignWrites();
	});

	it('waits for authoritative open settings before creating or enqueueing a new campaign', async () => {
		getPublicParameters.mockResolvedValue({
			...openSettings(),
			registrationEnabled: false,
		});
		let resolveSettings!: (settings: PublicParameters) => void;
		getPublicParametersForMutation.mockReturnValue(
			new Promise<PublicParameters>((resolve) => {
				resolveSettings = resolve;
			}),
		);
		const result = handlers.startWaitingListCampaign(startRequest());
		await vi.waitFor(() =>
			expect(getPublicParametersForMutation).toHaveBeenCalledOnce(),
		);
		expectNoCampaignWrites();
		resolveSettings(openSettings());
		await expect(result).resolves.toMatchObject({
			id: campaignId,
			status: 'queued',
		});
		expect(getPublicParameters).not.toHaveBeenCalled();
		expect(adminMock.getDocRef(campaignPath).create).toHaveBeenCalledOnce();
		expect(enqueue).toHaveBeenCalledWith({ campaignId, generation: 1 });
	});

	it('does not create or enqueue a campaign when authoritative settings fail', async () => {
		getPublicParametersForMutation.mockRejectedValue(
			new HttpsError('unavailable', 'Settings unavailable'),
		);
		await expect(
			handlers.startWaitingListCampaign(startRequest()),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		expect(getPublicParameters).not.toHaveBeenCalled();
		expectNoCampaignWrites();
	});

	it.each([
		'registration',
		'pre-registration',
		'maintenance',
		'weather',
	] as const)('rejects a new campaign during %s closure', async (gate) => {
		const settings = openSettings();
		if (gate === 'registration') settings.registrationEnabled = false;
		if (gate === 'pre-registration')
			settings.admin.preRegistrationEnabled = false;
		if (gate === 'maintenance') settings.maintenanceModeEnabled = true;
		if (gate === 'weather') settings.weatherModeEnabled = true;
		getPublicParametersForMutation.mockResolvedValue(settings);
		await expect(
			handlers.startWaitingListCampaign(startRequest()),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		expectNoCampaignWrites();
	});

	it.each(['replay', 'resume'] as const)(
		'preserves campaign %s while public settings are unavailable',
		async (operation) => {
			adminMock.setDocSnapshot(campaignPath, {
				programYear: 2025,
				status: 'paused',
				generation: 1,
				createdAt: new Date(),
				updatedAt: new Date(),
				memberCount: 1,
			});
			getPublicParameters.mockRejectedValue(
				new Error('Cached settings unavailable'),
			);
			getPublicParametersForMutation.mockRejectedValue(
				new HttpsError('unavailable', 'Settings unavailable'),
			);
			const result =
				operation === 'replay'
					? handlers.startWaitingListCampaign(startRequest())
					: handlers.resumeWaitingListCampaign(
							createCallableRequest(
								{ campaignId },
								{ owner: true },
							),
						);
			await expect(result).resolves.toMatchObject({ id: campaignId });
			expect(getPublicParameters).not.toHaveBeenCalled();
			expect(getPublicParametersForMutation).not.toHaveBeenCalled();
			if (operation === 'replay') expectNoCampaignWrites();
			else
				expect(enqueue).toHaveBeenCalledWith({
					campaignId,
					generation: 2,
				});
		},
	);
});
