import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultPublicParameters } from '../../../src/models';

const mocks = vi.hoisted(() => ({
	getIdTokenClient: vi.fn(),
	fetchIdToken: vi.fn(),
	fetcher: vi.fn(),
}));
vi.mock('google-auth-library', () => ({
	GoogleAuth: class {
		public getIdTokenClient = mocks.getIdTokenClient;
	},
}));
import {
	fetchPublicParametersFromGateway,
	PUBLIC_PARAMETERS_GATEWAY_URL_ENV,
} from '../../../src/utility/public-parameters';

const gatewayUrl = 'https://publicparametersgateway-example-uc.a.run.app';
const response = (body: unknown, ok = true, status = 200): object => ({
	ok,
	status,
	json: vi.fn().mockResolvedValue(body),
});

describe('Authenticated public parameters gateway client', () => {
	beforeEach(() => {
		vi.stubEnv(PUBLIC_PARAMETERS_GATEWAY_URL_ENV, gatewayUrl);
		mocks.fetchIdToken.mockResolvedValue('id-token');
		mocks.getIdTokenClient.mockResolvedValue({
			idTokenProvider: { fetchIdToken: mocks.fetchIdToken },
		});
		mocks.fetcher.mockReset();
	});

	it('uses the canonical URI as the ID-token audience and sends one authenticated request', async () => {
		mocks.fetcher.mockResolvedValue(
			response({
				settings: createDefaultPublicParameters(),
				source: 'fresh',
				lastFreshAt: 1_000,
			}),
		);

		await expect(fetchPublicParametersFromGateway(mocks.fetcher)).resolves.toEqual(
			createDefaultPublicParameters(),
		);
		expect(mocks.getIdTokenClient).toHaveBeenCalledWith(gatewayUrl);
		expect(mocks.fetchIdToken).toHaveBeenCalledWith(gatewayUrl);
		expect(mocks.fetcher).toHaveBeenCalledTimes(1);
		expect(mocks.fetcher).toHaveBeenCalledWith(
		gatewayUrl,
		{
			headers: { Accept: 'application/json', Authorization: 'Bearer id-token' },
			redirect: 'error',
			signal: expect.any(AbortSignal),
		},
	);
	});

	it.each([
		response({ error: 'bad' }, false, 503),
		response({ settings: createDefaultPublicParameters(), source: 'unknown', lastFreshAt: 1_000 }),
		response({ settings: {}, source: 'fresh', lastFreshAt: 1_000 }),
	])('rejects an invalid gateway response', async (gatewayResponse) => {
		mocks.fetcher.mockResolvedValue(gatewayResponse);
		await expect(fetchPublicParametersFromGateway(mocks.fetcher)).rejects.toThrow();
	});
});
