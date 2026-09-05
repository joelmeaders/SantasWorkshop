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
		await expect(resolvePublishedEmailTemplate({ templateKey: 'draft' }))
			.rejects.toThrow('does not have a published SES template');
	});

	it('resolves the published template and its explicit mappings', async () => {
		const summary = {
			key: 'confirmation', awsTemplateName: 'confirmation-published',
			publishedRevisionId: 'revision-1',
			fieldMappings: [{ name: 'guest', mapping: 'firstName' }],
		};
		database.setDocSnapshot('emailTemplates/confirmation', summary);
		const { resolvePublishedEmailTemplate } = await loadTemplates();
		await expect(resolvePublishedEmailTemplate({ templateKey: 'confirmation' }))
			.resolves.toEqual({ templateName: 'confirmation-published', templateSummary: summary });
	});

	it('preserves explicit placeholders when preparing HTML', async () => {
		const { prepareEmailTemplateHtmlForSes } = await loadTemplates();
		expect(prepareEmailTemplateHtmlForSes('<head></head><p>{{firstName}}</p><img src="{{qrCodeUrl}}">'))
			.toBe('<head><meta charset="utf-8"></head><p>{{firstName}}</p><img src="{{qrCodeUrl}}">');
	});
});
