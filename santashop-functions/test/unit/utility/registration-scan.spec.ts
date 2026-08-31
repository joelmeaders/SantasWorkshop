import { describe, expect, it } from 'vitest';
import {
	classifyDuplicateScan,
	fingerprintRegistrationCode,
} from '../../../src/utility/registration-scan';

describe('registration scan classification', () => {
	const prior = new Date('2025-12-10T18:00:00.000Z');

	it.each([
		[299, 'duplicate-accidental'],
		[300, 'duplicate-accidental'],
		[301, 'duplicate-risk'],
	] as const)('classifies a scan after %i seconds as %s', (seconds, outcome) => {
		expect(
			classifyDuplicateScan(
				prior,
				new Date(prior.getTime() + seconds * 1000),
			),
		).toBe(outcome);
	});

	it('creates a stable fingerprint without retaining the code', () => {
		const code = 'ABCD2345';
		const fingerprint = fingerprintRegistrationCode(code);

		expect(fingerprint).toHaveLength(64);
		expect(fingerprint).toBe(fingerprintRegistrationCode(code));
		expect(fingerprint).not.toContain(code);
	});
});
