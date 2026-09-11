import starter0 from '../../../../../assets/email-templates/2026/event-reminder-2026-en.json';
import starter1 from '../../../../../assets/email-templates/2026/event-reminder-2026-es.json';
import starter2 from '../../../../../assets/email-templates/2026/registration-cancellation-2026-en.json';
import starter3 from '../../../../../assets/email-templates/2026/registration-cancellation-2026-es.json';
import starter4 from '../../../../../assets/email-templates/2026/registration-confirmation-2026-en.json';
import starter5 from '../../../../../assets/email-templates/2026/registration-confirmation-2026-es.json';
import { describe, expect, it } from 'vitest';
import type { SaveEmailTemplateRevisionRequest } from '@santashop/models';
import {
	MAX_TEMPLATE_FILE_BYTES,
	parseTemplatePackage,
	serializeTemplatePackage,
	validateTemplateHtml,
} from './email-template-transfer';

const draft: SaveEmailTemplateRevisionRequest = {
	key: 'confirmation-es',
	language: 'es',
	deliveryProfile: 'registration-confirmation',
	displayName: 'Una bienvenida',
	awsTemplateName: 'confirmation-es',
	subjectPart: 'Hola {{firstName}}',
	html: '<p>¡Hola {{firstName}}!</p>',
	textPart: 'Hola {{firstName}}',
	seasonalReviewRequired: true,
	seasonalDetailsReviewed: false,
	fieldMappings: [
		{ name: 'firstName', mapping: 'firstName', sampleValue: 'María' },
	],
};

describe('email template file transfer', () => {
	it.each(['<!doctype html><html><body>Admin app</body></html>', '{'])(
		'reports unreadable JSON without exposing a parser error',
		(content) => {
			expect(() => parseTemplatePackage(content)).toThrow(
				'Expected a JSON template file.',
			);
		},
	);

	it.each([starter0, starter1, starter2, starter3, starter4, starter5])(
		'accepts and round trips the bundled starter $template.key',
		(starter) => {
			const parsed = parseTemplatePackage(JSON.stringify(starter));
			expect(
				parseTemplatePackage(serializeTemplatePackage(parsed)),
			).toMatchObject(parsed);
			expect(parsed.seasonalReviewRequired).toBe(true);
			expect(parsed.seasonalDetailsReviewed).toBe(false);
		},
	);

	it('round trips editable bilingual content without publication or server metadata', () => {
		const serialized = serializeTemplatePackage({
			...draft,
			publishedRevisionId: 'live',
			createdByUid: 'admin',
			htmlStoragePath: 'private/path',
			createOnly: true,
		} as SaveEmailTemplateRevisionRequest);
		expect(parseTemplatePackage(serialized)).toMatchObject(draft);
		expect(serialized).not.toMatch(
			/publishedRevisionId|createdByUid|htmlStoragePath|createOnly/,
		);
		expect(serialized).toContain('María');
	});

	it.each([
		{ version: 2 },
		{ format: 'ses' },
		{ template: { ...draft, language: 'fr' } },
		{ template: { ...draft, seasonalDetailsReviewed: 'yes' } },
		{ template: { ...draft, html: '<p>{{#if name}}bad{{/if}}</p>' } },
		{ template: { ...draft, fieldMappings: [] } },
		{ template: { ...draft, deliveryProfile: '__proto__' } },
	])('rejects invalid packages: %j', (override) => {
		expect(() =>
			parseTemplatePackage(
				JSON.stringify({
					format: 'santashop-email-template',
					version: 1,
					template: draft,
					...override,
				}),
			),
		).toThrow();
	});

	it('rejects oversized files and malformed or unsafe placeholders', () => {
		expect(() =>
			parseTemplatePackage(' '.repeat(MAX_TEMPLATE_FILE_BYTES + 1)),
		).toThrow('1 MB');
		for (const html of [
			'',
			'{{firstName',
			'{{__proto__.name}}',
			'{{{firstName}}}',
		])
			expect(() => validateTemplateHtml(html)).toThrow();
		expect(() =>
			validateTemplateHtml('<p>Hola {{firstName}}</p>'),
		).not.toThrow();
	});

	it('does not permit QR fields in a cancellation template', () => {
		expect(() =>
			serializeTemplatePackage({
				...draft,
				deliveryProfile: 'registration-cancellation',
				fieldMappings: [
					{
						name: 'firstName',
						mapping: 'qrCodeUrl',
						sampleValue: '',
					},
				],
			}),
		).toThrow('Unsupported runtime field');
	});
});
