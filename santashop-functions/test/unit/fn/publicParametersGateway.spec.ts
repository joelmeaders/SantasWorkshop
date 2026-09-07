import type { Request } from 'firebase-functions/v2/https';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultPublicParameters } from '../../../src/models';
import { createPublicParametersGatewayHandler } from '../../../src/fn/publicParametersGateway';
import { PublicParametersGatewayCache } from '../../../src/utility/public-parameters-gateway';

interface TestResponse {
	set: ReturnType<typeof vi.fn>;
	status: ReturnType<typeof vi.fn>;
	json: ReturnType<typeof vi.fn>;
}

const response = (): TestResponse => {
	const result = {
		set: vi.fn(),
		status: vi.fn(),
		json: vi.fn(),
	};
	result.set.mockReturnValue(result);
	result.status.mockReturnValue(result);
	return result;
};

const cache = (): PublicParametersGatewayCache =>
	new PublicParametersGatewayCache(vi.fn());

describe('public parameters gateway handler', () => {
	it('returns cached settings for a GET request with private no-store headers', async () => {
		const gatewayCache = cache();
		const settings = createDefaultPublicParameters();
		vi.spyOn(gatewayCache, 'read').mockResolvedValue({
			settings,
			source: 'fresh',
			lastFreshAt: 1_000,
		});
		const handler = createPublicParametersGatewayHandler(gatewayCache);
		const result = response();

		await handler({ method: 'GET' } as Request, result);

		expect(result.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
		expect(result.status).toHaveBeenCalledWith(200);
		expect(result.json).toHaveBeenCalledWith({
			settings,
			source: 'fresh',
			lastFreshAt: 1_000,
		});
	});

	it('rejects non-GET requests without reading settings', async () => {
		const gatewayCache = cache();
		const read = vi.spyOn(gatewayCache, 'read');
		const handler = createPublicParametersGatewayHandler(gatewayCache);
		const result = response();

		await handler({ method: 'POST' } as Request, result);

		expect(read).not.toHaveBeenCalled();
		expect(result.status).toHaveBeenCalledWith(405);
		expect(result.set).toHaveBeenCalledWith('Allow', 'GET');
		expect(result.json).toHaveBeenCalledWith({ error: 'GET is required.' });
	});

	it('returns 503 when the cache has no available settings', async () => {
		const gatewayCache = cache();
		vi.spyOn(gatewayCache, 'read').mockRejectedValue(new Error('offline'));
		const handler = createPublicParametersGatewayHandler(gatewayCache);
		const result = response();

		await handler({ method: 'GET' } as Request, result);

		expect(result.status).toHaveBeenCalledWith(503);
		expect(result.json).toHaveBeenCalledWith({ error: 'Public settings are unavailable.' });
	});
});
