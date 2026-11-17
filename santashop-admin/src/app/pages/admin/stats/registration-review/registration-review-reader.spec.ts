import { describe, expect, it } from 'vitest';
import {
	canReadRegistrationReview,
	normalizeReviewSearch,
} from './registration-review-reader';

describe('registration review claims', () => {
	it('allows an Owner and only an Admin with the explicit delegated review role', () => {
		expect(canReadRegistrationReview({ owner: true })).toBe(true);
		expect(
			canReadRegistrationReview({
				roles: ['admin', 'registration-review'],
			}),
		).toBe(true);
		expect(canReadRegistrationReview({ roles: ['admin'] })).toBe(false);
		expect(
			canReadRegistrationReview({ roles: ['registration-review'] }),
		).toBe(false);
		expect(
			canReadRegistrationReview({
				roles: ['checkin', 'registration-review'],
			}),
		).toBe(false);
		expect(
			canReadRegistrationReview({
				owner: 'true',
				roles: 'admin registration-review',
			}),
		).toBe(false);
		expect(canReadRegistrationReview(undefined)).toBe(false);
	});
});

describe('registration review search', () => {
	it('trims and lowercases complete adult emails without altering full case-sensitive IDs', () => {
		expect(normalizeReviewSearch('  FaMiLy+Shop@Example.Test  ')).toBe(
			'family+shop@example.test',
		);
		expect(normalizeReviewSearch(' ReG_001-Case ')).toBe('ReG_001-Case');
		expect(normalizeReviewSearch('   ')).toBe('');
	});

	it('rejects partial, malformed and oversized inputs', () => {
		for (const input of [
			'family@',
			'@example.test',
			'family@host',
			'a@@example.test',
			'family name@example.test',
			'case 001',
			'x'.repeat(81),
			'a'.repeat(255) + '@example.test',
		]) {
			expect(normalizeReviewSearch(input)).toBeNull();
		}
	});
});
