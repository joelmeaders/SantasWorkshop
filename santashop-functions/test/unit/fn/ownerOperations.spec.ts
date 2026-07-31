import { describe, expect, it } from 'vitest';
import { isOwnerOperationSeasonOpen } from '../../../src/fn/ownerOperations';

describe('owner operation seasonal window', () => {
	it('accepts the first instant of January in the shop timezone', () => {
		expect(
			isOwnerOperationSeasonOpen(
				new Date('2026-01-01T07:00:00.000Z'),
			),
		).toBe(true);
	});

	it('accepts the final instant of September 15 in the shop timezone', () => {
		expect(
			isOwnerOperationSeasonOpen(
				new Date('2026-09-16T05:59:59.999Z'),
			),
		).toBe(true);
	});

	it('rejects the first instant of September 16 in the shop timezone', () => {
		expect(
			isOwnerOperationSeasonOpen(
				new Date('2026-09-16T06:00:00.000Z'),
			),
		).toBe(false);
	});
});
