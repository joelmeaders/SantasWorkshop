import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

let database: ReturnType<typeof createBackgroundAdminMock>;

const loadTemplates = async () => {
	vi.resetModules();
	vi.doMock('firebase-admin', () => database.module);
	return import('../../../src/utility/email-templates');
};

describe('published email template contract', () => {
	beforeEach(() => {
		database = createBackgroundAdminMock();
	});

	it('requires a template reference', async () => {
		const { resolvePublishedEmailTemplate } = await loadTemplates();
		await expect(resolvePublishedEmailTemplate({})).rejects.toThrow(
			'A published email template reference is required.',
		);
	});

	it('rejects an unpublished template', async () => {
		database.setDocSnapshot('emailTemplates/draft', { key: 'draft' });
		const { resolvePublishedEmailTemplate } = await loadTemplates();
		await expect(
			resolvePublishedEmailTemplate({ templateKey: 'draft' }),
		).rejects.toThrow('does not have a published SES template');
	});

	it('resolves the published template and its explicit mappings', async () => {
		const summary = {
			key: 'confirmation',
			awsTemplateName: 'confirmation-published',
			publishedRevisionId: 'revision-1',
			fieldMappings: [{ name: 'guest', mapping: 'firstName' }],
		};
		database.setDocSnapshot('emailTemplates/confirmation', summary);
		database.setDocSnapshot(
			'emailTemplates/confirmation/revisions/revision-1',
			{ fieldMappings: summary.fieldMappings },
		);
		const { resolvePublishedEmailTemplate } = await loadTemplates();
		await expect(
			resolvePublishedEmailTemplate({ templateKey: 'confirmation' }),
		).resolves.toEqual({
			language: 'en',
			templateName: 'confirmation-published',
			templateSummary: summary,
		});
	});

	it('preserves explicit placeholders when preparing HTML', async () => {
		const { prepareEmailTemplateHtmlForSes } = await loadTemplates();
		expect(
			prepareEmailTemplateHtmlForSes(
				'<head></head><p>{{firstName}}</p><img src="{{qrCodeUrl}}">',
			),
		).toBe(
			'<head><meta charset="utf-8"></head><p>{{firstName}}</p><img src="{{qrCodeUrl}}">',
		);
	});

	it('accepts only plain Handlebars placeholders', async () => {
		const { validateHandlebarsSyntax } = await loadTemplates();
		expect(() =>
			validateHandlebarsSyntax('Hello {{firstName}}'),
		).not.toThrow();
		expect(() =>
			validateHandlebarsSyntax('{{#if firstName}}Hello{{/if}}'),
		).toThrow(
			'Only plain Handlebars placeholders like {{field}} are supported.',
		);
		expect(() => validateHandlebarsSyntax('{{{firstName}}}')).toThrow(
			'Only plain Handlebars placeholders like {{field}} are supported.',
		);
		expect(() => validateHandlebarsSyntax('{{& firstName}}')).toThrow(
			'Only plain Handlebars placeholders like {{field}} are supported.',
		);
		expect(() => validateHandlebarsSyntax('{{firstName}}}')).toThrow(
			'Only plain Handlebars placeholders like {{field}} are supported.',
		);
		expect(() => validateHandlebarsSyntax('}}')).toThrow(
			'Only plain Handlebars placeholders like {{field}} are supported.',
		);
	});

	it('preserves plain placeholder values in test rendering', async () => {
		const { renderTemplateWithFieldValues } = await loadTemplates();
		expect(
			renderTemplateWithFieldValues('{{firstName}}', [
				{
					name: 'firstName',
					mapping: 'firstName',
					sampleValue: '<Buddy & friends>',
				},
			]),
		).toBe('<Buddy & friends>');
		expect(
			renderTemplateWithFieldValues('{{firstName}}', [
				{
					name: 'firstName',
					mapping: 'firstName',
					sampleValue: '$& $1',
				},
			]),
		).toBe('$& $1');
	});

	it('rejects unsafe or malformed field paths', async () => {
		const { normalizeEmailTemplateFieldDefinitions } =
			await loadTemplates();
		expect(() =>
			normalizeEmailTemplateFieldDefinitions([
				{ name: '__proto__', mapping: 'firstName', sampleValue: 'x' },
			]),
		).toThrow('must use letters');
		expect(() =>
			normalizeEmailTemplateFieldDefinitions([
				{
					name: 'contact..name',
					mapping: 'firstName',
					sampleValue: 'x',
				},
			]),
		).toThrow('must use letters');
		expect(() =>
			normalizeEmailTemplateFieldDefinitions([
				{
					name: 'displayName',
					mapping: 'constructor',
					sampleValue: 'x',
				},
			]),
		).toThrow('must use letters');
	});
	it('selects the latest published revision in the requested language using Firestore timestamps', async () => {
		const profile = 'event-reminder';
		const entries = [
			{
				key: 'es-old',
				language: 'es',
				publishedOn: { toDate: (): Date => new Date('2026-01-01') },
				publishedRevisionId: 'live',
			},
			{
				key: 'en-new',
				language: 'en',
				publishedOn: { toDate: (): Date => new Date('2026-09-01') },
				publishedRevisionId: 'live',
			},
			{
				key: 'es-new',
				language: 'es',
				publishedOn: { toDate: (): Date => new Date('2026-08-01') },
				publishedRevisionId: 'live',
			},
			{
				key: 'es-draft',
				language: 'es',
				updatedOn: new Date('2026-10-01'),
			},
		];
		database.setCollectionDocs(
			'emailTemplates',
			entries.map((entry) => ({
				id: entry.key,
				data: {
					...entry,
					displayName: entry.key,
					awsTemplateName: entry.key,
					deliveryProfile: profile,
				},
			})),
		);
		for (const entry of entries)
			database.setDocSnapshot(
				'emailTemplates/' + entry.key + '/revisions/live',
				{
					language: entry.language,
					deliveryProfile: profile,
					fieldMappings: [],
				},
			);
		const { resolvePublishedEmailTemplate } = await loadTemplates();
		expect(
			(
				await resolvePublishedEmailTemplate({
					templateKey: profile,
					language: 'es',
				})
			).templateName,
		).toBe('es-new');
	});
});
