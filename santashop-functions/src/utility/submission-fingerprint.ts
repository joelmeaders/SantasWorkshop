import { createHmac } from 'node:crypto';
import type { Child, Registration } from '../models';

const DOMAIN = 'dscs.registration-submission.v1';

export interface SubmissionFingerprint {
	version: 1;
	keyId: string;
	hmacSha256: string;
}

type Submission = Pick<
	Registration,
	| 'programYear'
	| 'registrationSubmittedOn'
	| 'firstName'
	| 'lastName'
	| 'emailAddress'
	| 'zipCode'
	| 'dateTimeSlot'
	| 'children'
>;

const timestamp = (value: unknown): readonly [number, number] => {
	if (value instanceof Date) {
		const milliseconds = value.getTime();
		const seconds = Math.floor(milliseconds / 1_000);
		if (Number.isFinite(milliseconds)) {
			return [seconds, (milliseconds - seconds * 1_000) * 1_000_000];
		}
	} else if (value && typeof value === 'object') {
		const { seconds, nanoseconds } = value as Record<string, unknown>;
		if (
			typeof seconds === 'number' &&
			Number.isSafeInteger(seconds) &&
			typeof nanoseconds === 'number' &&
			Number.isInteger(nanoseconds) &&
			nanoseconds >= 0 &&
			nanoseconds < 1_000_000_000
		) {
			return [seconds, nanoseconds];
		}
	}
	throw new Error('Invalid fingerprint timestamp.');
};

const isString = (value: unknown): value is string => typeof value === 'string';
const childFields = (
	child: Child,
): readonly [number, string, string, readonly [number, number], boolean] => {
	if (
		typeof child.id !== 'number' ||
		!Number.isSafeInteger(child.id) ||
		child.id < 0 ||
		!isString(child.firstName) ||
		!isString(child.lastName) ||
		typeof child.enabled !== 'boolean'
	) {
		throw new Error('Invalid fingerprint child fields.');
	}
	return [
		child.id,
		child.firstName,
		child.lastName,
		timestamp(child.dateOfBirth),
		child.enabled,
	];
};

/** Optional evidence for a completed write, not a validation or eligibility rule. */
export const createSubmissionFingerprint = (
	uid: string,
	submission: Submission,
): SubmissionFingerprint | undefined => {
	try {
		const encodedKey = process.env['SANTASHOP_SUBMISSION_FINGERPRINT_KEY'];
		const keyId = process.env['SANTASHOP_SUBMISSION_FINGERPRINT_KEY_ID'];
		if (
			!encodedKey ||
			!/^[A-Za-z0-9+/]{43}=$/u.test(encodedKey) ||
			!keyId ||
			!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u.test(keyId)
		) {
			return undefined;
		}
		const key = Buffer.from(encodedKey, 'base64');
		if (key.length !== 32 || key.toString('base64') !== encodedKey)
			return undefined;

		const {
			programYear,
			registrationSubmittedOn,
			firstName,
			lastName,
			emailAddress,
			zipCode,
			dateTimeSlot,
			children,
		} = submission;
		if (
			!uid ||
			!Number.isSafeInteger(programYear) ||
			!isString(firstName) ||
			!isString(lastName) ||
			!isString(emailAddress) ||
			!isString(zipCode) ||
			!isString(dateTimeSlot?.id) ||
			!children?.length
		) {
			return undefined;
		}

		// Version 1 uses this fixed field order and the stored roster order.
		const payload = JSON.stringify([
			DOMAIN,
			keyId,
			uid,
			programYear,
			timestamp(registrationSubmittedOn),
			[firstName, lastName, emailAddress, zipCode],
			[dateTimeSlot.id, timestamp(dateTimeSlot.dateTime)],
			children.map(childFields),
		]);
		return {
			version: 1,
			keyId,
			hmacSha256: createHmac('sha256', key)
				.update(payload, 'utf8')
				.digest('hex'),
		};
	} catch {
		// Never block a registration or log a key, roster, or input when evidence is unavailable.
		return undefined;
	}
};
