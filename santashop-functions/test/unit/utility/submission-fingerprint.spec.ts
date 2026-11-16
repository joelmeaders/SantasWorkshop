import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSubmissionFingerprint } from '../../../src/utility/submission-fingerprint';

const fixtureKey = Buffer.alloc(32, 17);
const useFixtureKey = (): void => {
	vi.stubEnv(
		'SANTASHOP_SUBMISSION_FINGERPRINT_KEY',
		fixtureKey.toString('base64'),
	);
	vi.stubEnv('SANTASHOP_SUBMISSION_FINGERPRINT_KEY_ID', 'fixture-key-v1');
};
const fixture = () => ({
	programYear: 2025,
	registrationSubmittedOn: new Date('2025-11-20T10:00:00.123Z'),
	firstName: 'Parent',
	lastName: 'Example',
	emailAddress: 'parent@example.com',
	zipCode: '80205',
	dateTimeSlot: {
		id: 'fixture-slot',
		dateTime: new Date('2025-12-11T10:00:00.456Z'),
	},
	children: [
		{
			id: 1,
			firstName: 'Child',
			lastName: 'Example',
			dateOfBirth: new Date('2020-01-01T00:00:00.000Z'),
			enabled: true,
		},
	],
});

describe('registration submission fingerprint', () => {
	afterEach(() => vi.unstubAllEnvs());

	it('commits to the explicit version 1 fields with a keyed HMAC', () => {
		useFixtureKey();
		const payload = [
			'dscs.registration-submission.v1',
			'fixture-key-v1',
			'fixture-uid',
			2025,
			[Date.parse('2025-11-20T10:00:00Z') / 1000, 123_000_000],
			['Parent', 'Example', 'parent@example.com', '80205'],
			[
				'fixture-slot',
				[Date.parse('2025-12-11T10:00:00Z') / 1000, 456_000_000],
			],
			[
				[
					1,
					'Child',
					'Example',
					[Date.parse('2020-01-01T00:00:00Z') / 1000, 0],
					true,
				],
			],
		];
		const expected = createHmac('sha256', fixtureKey)
			.update(JSON.stringify(payload), 'utf8')
			.digest('hex');
		expect(createSubmissionFingerprint('fixture-uid', fixture())).toEqual({
			version: 1,
			keyId: 'fixture-key-v1',
			hmacSha256: expected,
		});
		expect(
			createSubmissionFingerprint('fixture-uid', fixture())?.hmacSha256,
		).toBe(expected);
		expect(
			createSubmissionFingerprint('other-fixture-uid', fixture())
				?.hmacSha256,
		).not.toBe(expected);
	});

	it('changes when an included value or stored child order changes', () => {
		useFixtureKey();
		const submission = fixture();
		submission.children.push({
			...submission.children[0],
			id: 2,
			firstName: 'Sibling',
		});
		const original = createSubmissionFingerprint('fixture-uid', submission);
		const changed = structuredClone(submission);
		changed.children[0].dateOfBirth = new Date('2020-01-02T00:00:00Z');
		expect(createSubmissionFingerprint('fixture-uid', changed)).not.toEqual(
			original,
		);
		changed.children[0].dateOfBirth = submission.children[0].dateOfBirth;
		changed.children.reverse();
		expect(createSubmissionFingerprint('fixture-uid', changed)).not.toEqual(
			original,
		);
		expect(
			createSubmissionFingerprint('fixture-uid', {
				...submission,
				dateTimeSlot: {
					...submission.dateTimeSlot,
					id: 'different-slot',
				},
			}),
		).not.toEqual(original);
	});

	it('treats a Firestore timestamp and a Date for the same instant consistently', () => {
		useFixtureKey();
		const submission = fixture();
		const original = createSubmissionFingerprint('fixture-uid', submission);
		const firestoreTimestamp = {
			seconds: Date.parse('2025-12-11T10:00:00Z') / 1000,
			nanoseconds: 456_000_000,
		} as unknown as Date;
		expect(
			createSubmissionFingerprint('fixture-uid', {
				...submission,
				dateTimeSlot: {
					...submission.dateTimeSlot,
					dateTime: firestoreTimestamp,
				},
			}),
		).toEqual(original);
	});

	it('does not produce evidence when the key is missing or invalid or a timestamp cannot be encoded', () => {
		vi.stubEnv('SANTASHOP_SUBMISSION_FINGERPRINT_KEY', undefined);
		vi.stubEnv('SANTASHOP_SUBMISSION_FINGERPRINT_KEY_ID', undefined);
		expect(
			createSubmissionFingerprint('fixture-uid', fixture()),
		).toBeUndefined();
		useFixtureKey();
		vi.stubEnv('SANTASHOP_SUBMISSION_FINGERPRINT_KEY', 'invalid-key');
		expect(
			createSubmissionFingerprint('fixture-uid', fixture()),
		).toBeUndefined();
		useFixtureKey();
		expect(
			createSubmissionFingerprint('fixture-uid', {
				...fixture(),
				registrationSubmittedOn: new Date(NaN),
			}),
		).toBeUndefined();
	});
});
