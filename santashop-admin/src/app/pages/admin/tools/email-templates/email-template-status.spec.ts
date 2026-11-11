import { describe, expect, it } from 'vitest';
import type { EmailTemplateSummary } from '@santashop/models';
import { currentDeliveryTemplateKeys } from './email-template-status';

const template = (
	key: string,
	overrides: Partial<EmailTemplateSummary> = {},
): EmailTemplateSummary => ({
	key,
	deliveryProfile: 'registration-confirmation',
	displayName: key,
	subjectPart: '',
	awsTemplateName: key,
	fieldMappings: [],
	createdOn: new Date('2026-01-01'),
	updatedOn: new Date('2026-11-11'),
	publishedRevisionId: 'r1',
	publishedOn: new Date('2026-11-10'),
	...overrides,
});

describe('currentDeliveryTemplateKeys', () => {
	it('selects newest publication, not newest draft edit, separately for profile and language', () => {
		const keys = currentDeliveryTemplateKeys([
			template('old', { publishedOn: new Date('2026-10-01') }),
			template('current'),
			template('draft', { publishedRevisionId: undefined }),
			template('spanish', { language: 'es' }),
			template('reminder', { deliveryProfile: 'event-reminder' }),
		]);
		expect([...keys].sort()).toEqual(['current', 'reminder', 'spanish']);
	});
	it('uses key ties, legacy English, and updatedOn fallback consistently with delivery', () => {
		expect([
			...currentDeliveryTemplateKeys([
				template('z', { language: 'en', publishedOn: false }),
				template('a', { publishedOn: false }),
			]),
		]).toEqual(['a']);
	});
	it('handles callable-serialized Firestore timestamps with millisecond precision', () => {
		expect([
			...currentDeliveryTemplateKeys([
				template('a-old', {
					publishedOn: {
						_seconds: 100,
						_nanoseconds: 0,
					} as unknown as Date,
				}),
				template('z-new', {
					publishedOn: {
						_seconds: 100,
						_nanoseconds: 500000000,
					} as unknown as Date,
				}),
			]),
		]).toEqual(['z-new']);
	});
});
