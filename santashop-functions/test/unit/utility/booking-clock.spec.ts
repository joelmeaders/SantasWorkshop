import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { getBookingNow } from '../../../src/utility/booking-clock';

describe('booking server clock', () => {
	afterEach(() => vi.unstubAllEnvs());
	it.each([
		['false', '127.0.0.1:8080'],
		['true', 'firestore.googleapis.com:443'],
	])(
		'ignores test overrides with emulator flag %s and host %s',
		async (emulator, host) => {
			vi.stubEnv('FUNCTIONS_EMULATOR', emulator);
			vi.stubEnv('FIRESTORE_EMULATOR_HOST', host);
			const now = Date.parse('2025-12-10T18:00:00.000Z');
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const doc = vi.fn();
			expect(
				await getBookingNow({ doc } as unknown as Firestore),
			).toEqual(new Date(now));
			expect(doc).not.toHaveBeenCalled();
		},
	);
	it('reads an explicit clock only from the local emulator fixture', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
		const doc = vi
			.fn()
			.mockReturnValue({
				get: vi
					.fn()
					.mockResolvedValue({
						data: () => ({ now: '2025-12-10T18:00:00.000Z' }),
					}),
			});
		expect(await getBookingNow({ doc } as unknown as Firestore)).toEqual(
			new Date('2025-12-10T18:00:00.000Z'),
		);
		expect(doc).toHaveBeenCalledWith('_testConfig/bookingClock');
	});
});
