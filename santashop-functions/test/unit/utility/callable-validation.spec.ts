import { describe, expect, it } from 'vitest';
import {
	CallableValidationError,
	requireArray,
	requireBoolean,
	requireCallableData,
	requireEmailAddress,
	requireOptionalTrimmedString,
	requireZipCodeValue,
	throwMappedAuthHttpsError,
	withCallableValidation,
} from '../../../src/utility/callable-validation';

describe('callable validation', () => {
	const captureError = (callback: () => unknown): unknown => {
		try {
			callback();
		} catch (error) {
			return error;
		}
		throw new Error('Expected callback to throw.');
	};

	it('normalizes optional strings and rejects malformed request fields', () => {
		expect(requireOptionalTrimmedString('  north  ', 'Referral')).toBe('north');
		expect(requireOptionalTrimmedString('   ', 'Referral')).toBeUndefined();
		expect(() => requireCallableData(null)).toThrow(CallableValidationError);
		expect(() => requireArray({}, 'Children')).toThrow(/Children must be an array/);
		expect(() => requireBoolean('yes', 'Newsletter')).toThrow(/true or false/);
	});

	it('validates email and ZIP values without coercing invalid input', () => {
		expect(requireEmailAddress(' BUDDY@EXAMPLE.COM ')).toBe('buddy@example.com');
		expect(requireZipCodeValue(' 80205 ')).toBe('80205');
		expect(requireZipCodeValue(1234)).toBe(1234);
		expect(() => requireZipCodeValue('8020')).toThrow(/valid US ZIP code/);
		expect(() => requireEmailAddress('not-an-email')).toThrow(/valid email address/);
		expect(() => requireZipCodeValue(Number.NaN)).toThrow(/valid five-digit/);
	});

	it('converts validation and Auth failures into callable HTTPS errors', () => {
		expect(
			captureError(() => withCallableValidation(() => {
				throw new CallableValidationError('Bad input');
			})),
		).toMatchObject({ code: 'invalid-argument', message: 'Bad input' });
		expect(captureError(() =>
		throwMappedAuthHttpsError(
			{ code: 'auth/invalid-email', message: 'Invalid address' },
			'Fallback',
		),
	)).toMatchObject({ code: 'invalid-argument', message: 'Invalid address' });
		expect(captureError(() =>
		throwMappedAuthHttpsError(
			{ code: 'auth/user-not-found', message: 'Unknown user' },
			'Fallback',
		),
	)).toMatchObject({ code: 'not-found', message: 'Unknown user' });
	});
});
