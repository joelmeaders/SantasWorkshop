import { describe, expect, it, vi } from 'vitest';
import {
	createDefaultPublicParameters,
	type PublicParameters,
} from '../../../src/models';
import {
	PublicParametersGatewayCache,
} from '../../../src/utility/public-parameters-gateway';
import {
	PUBLIC_PARAMETERS_GATEWAY_URL_ENV,
	publicParametersGatewayUrl,
} from '../../../src/utility/public-parameters';

describe('Public parameters gateway cache', () => {
	it('coalesces an 80-request cold burst into one management API read', async () => {
		let release: (value: PublicParameters) => void = () => undefined;
		const fetchSettings = vi.fn(() => new Promise<PublicParameters>((resolve) => {
			release = resolve;
		}));
		const cache = new PublicParametersGatewayCache(fetchSettings);
		const reads = Array.from({ length: 80 }, () => cache.read());

		await Promise.resolve();
		expect(fetchSettings).toHaveBeenCalledTimes(1);
		release(createDefaultPublicParameters());
		const results = await Promise.all(reads);

		expect(results).toHaveLength(80);
		expect(results.every((result) => result.source === 'fresh')).toBe(true);
		expect(fetchSettings).toHaveBeenCalledTimes(1);
	});

	it('limits replacement churn to one refresh per new instance and caches each result', async () => {
		const fetchSettings = vi.fn().mockResolvedValue(createDefaultPublicParameters());
		const previousInstance = new PublicParametersGatewayCache(fetchSettings);
		const replacementInstance = new PublicParametersGatewayCache(fetchSettings);

		await Promise.all([previousInstance.read(), replacementInstance.read()]);
		await Promise.all([previousInstance.read(), replacementInstance.read()]);

		expect(fetchSettings).toHaveBeenCalledTimes(2);
	});

	it('coalesces concurrent cold reads and serves fresh data for ten seconds', async () => {
		let now = 1_000;
		const fetchSettings = vi.fn().mockResolvedValue({
			...createDefaultPublicParameters(),
			maintenanceModeEnabled: true,
		});
		const cache = new PublicParametersGatewayCache(fetchSettings, () => now);

		const first = cache.read();
		const second = cache.read();
		expect(await Promise.all([first, second])).toEqual([
			{
				settings: { ...createDefaultPublicParameters(), maintenanceModeEnabled: true },
				source: 'fresh',
				lastFreshAt: 1_000,
			},
			{
				settings: { ...createDefaultPublicParameters(), maintenanceModeEnabled: true },
				source: 'fresh',
				lastFreshAt: 1_000,
			},
		]);
		now = 9_999;
		await cache.read();
		expect(fetchSettings).toHaveBeenCalledTimes(1);
	});

	it('returns validated stale data on failure and uses ten, thirty, sixty, and three hundred second backoff', async () => {
		let now = 0;
		const fetchSettings = vi
			.fn()
			.mockResolvedValueOnce(createDefaultPublicParameters())
			.mockRejectedValue(new Error('offline'));
		const cache = new PublicParametersGatewayCache(fetchSettings, () => now);

		expect((await cache.read()).source).toBe('fresh');
		now = 10_000;
		expect((await cache.read()).source).toBe('stale');
		expect(fetchSettings).toHaveBeenCalledTimes(2);
		now = 19_999;
		expect((await cache.read()).source).toBe('stale');
		now = 20_000;
		expect((await cache.read()).source).toBe('stale');
		now = 49_999;
		expect((await cache.read()).source).toBe('stale');
		now = 50_000;
		expect((await cache.read()).source).toBe('stale');
	});

	it('retries a stale cache at each backoff boundary and recovers on the next successful read', async () => {
		let now = 0;
		const fetchSettings = vi
			.fn()
			.mockResolvedValueOnce(createDefaultPublicParameters())
			.mockRejectedValueOnce(new Error('offline-10'))
			.mockRejectedValueOnce(new Error('offline-30'))
			.mockRejectedValueOnce(new Error('offline-60'))
			.mockResolvedValueOnce({
				...createDefaultPublicParameters(),
				maintenanceModeEnabled: true,
			});
		const cache = new PublicParametersGatewayCache(fetchSettings, () => now);

		await cache.read();
		for (const boundary of [10_000, 20_000, 50_000]) {
			now = boundary;
			expect((await cache.read()).source).toBe('stale');
		}
		expect(fetchSettings).toHaveBeenCalledTimes(4);

		now = 110_000;
		expect(await cache.read()).toMatchObject({
			settings: { maintenanceModeEnabled: true },
			source: 'fresh',
			lastFreshAt: 110_000,
		});
		expect(fetchSettings).toHaveBeenCalledTimes(5);
	});

	it('keeps a cold cache unavailable during backoff, then retries after the failure', async () => {
		let now = 0;
		const fetchSettings = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(createDefaultPublicParameters());
		const cache = new PublicParametersGatewayCache(fetchSettings, () => now);

		await expect(cache.read()).rejects.toThrow('offline');
		now = 9_999;
		await expect(cache.read()).rejects.toThrow('Public settings are not available.');
		expect(fetchSettings).toHaveBeenCalledTimes(1);
		now = 10_000;
		expect((await cache.read()).source).toBe('fresh');
		expect(fetchSettings).toHaveBeenCalledTimes(2);
	});

	it('fails cold when no validated settings exist', async () => {
		const cache = new PublicParametersGatewayCache(
			vi.fn().mockRejectedValue(new Error('offline')),
		);
		await expect(cache.read()).rejects.toThrow('offline');
	});
});

describe('Public parameters gateway URL', () => {
	it('returns the canonical Cloud Run origin', () => {
		vi.stubEnv(
			PUBLIC_PARAMETERS_GATEWAY_URL_ENV,
			'https://publicparametersgateway-example-uc.a.run.app/',
		);
		expect(publicParametersGatewayUrl()).toBe(
			'https://publicparametersgateway-example-uc.a.run.app',
		);
	});

	it.each([
		'http://publicparametersgateway-example-uc.a.run.app',
		'https://evil-example-uc.a.run.app',
		'https://publicparametersgateway-example-uc.a.run.app/path',
		'https://user:pass@publicparametersgateway-example-uc.a.run.app',
		'https://publicparametersgateway-example-uc.a.run.app?token=secret',
	])('rejects unsafe gateway URL %s', (value) => {
		vi.stubEnv(PUBLIC_PARAMETERS_GATEWAY_URL_ENV, value);
		expect(() => publicParametersGatewayUrl()).toThrow();
	});
});
