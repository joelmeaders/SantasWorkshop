import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createDefaultPublicParameters,
	PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY,
} from '../../../src/models';

const remoteConfig = {
	getTemplate: vi.fn(),
	validateTemplate: vi.fn(),
	publishTemplate: vi.fn(),
};
const initializeApp = vi.fn();

const template = () => ({
	etag: 'etag-1',
	version: { versionNumber: '1' },
	conditions: [],
	parameters: {},
	parameterGroups: {
		controls: {
			parameters: {
				[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY]: {
					valueType: 'JSON',
					defaultValue: {
						value: JSON.stringify(createDefaultPublicParameters()),
					},
				},
			},
		},
	},
});

describe('Public settings owner cold start', () => {
	beforeEach(() => {
		vi.resetModules();
		remoteConfig.getTemplate.mockResolvedValue(template());
		remoteConfig.validateTemplate.mockImplementation(
			async (value) => value,
		);
		remoteConfig.publishTemplate.mockImplementation(async (value) => ({
			...(value as object),
			etag: 'etag-2',
			version: { versionNumber: '2' },
		}));
		vi.doMock('firebase-admin', () => ({
			apps: [],
			initializeApp,
			remoteConfig: vi.fn(() => remoteConfig),
			firestore: vi.fn(),
		}));
	});

	afterEach(() => {
		vi.doUnmock('firebase-admin');
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it('initializes Firebase Admin before the first read and publish', async () => {
		const {
			readPublicParametersSettings,
			publishPublicParametersSettings,
		} = await import('../../../src/fn/publicParametersSettings');
		const request = {
			auth: { uid: 'owner', token: { owner: true } },
			data: {},
		} as never;

		expect(await readPublicParametersSettings(request)).toMatchObject({
			etag: 'etag-1',
			version: '1',
		});
		expect(
			await publishPublicParametersSettings({
				...request,
				data: {
					expectedEtag: 'etag-1',
					settings: {
						...createDefaultPublicParameters(),
						maintenanceModeEnabled: true,
					},
				},
			}),
		).toMatchObject({ etag: 'etag-2', version: '2' });
		expect(initializeApp).toHaveBeenCalledTimes(1);
		expect(remoteConfig.getTemplate).toHaveBeenCalledTimes(2);
		expect(remoteConfig.publishTemplate).toHaveBeenCalledTimes(1);
	});
});
