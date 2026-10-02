import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmailTemplatePackage } from '@santashop/models';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	loadEmailTemplateHandlers,
	sesSendMock,
} from '../helpers/email-template.unit-helper';

const starterRoot = resolve(
	process.cwd(),
	'../santashop-admin/src/assets/email-templates/2026',
);
const packages = readdirSync(starterRoot)
	.filter((name) => name.endsWith('.json'))
	.map(
		(name) =>
			JSON.parse(
				readFileSync(resolve(starterRoot, name), 'utf8'),
			) as EmailTemplatePackage,
	);
afterEach(() => vi.unstubAllEnvs());

describe('all bilingual email starter links', () => {
	it.each(
		packages.flatMap(({ template }) => [
			{ template, root: 'https://test.denversantaclausshop.org/' },
			{ template, root: 'https://register.denversantaclausshop.org/' },
		]),
	)(
		'$template.key sends HTML and plain text for $root',
		async ({ template, root }) => {
			vi.stubEnv(
				'SANTASHOP_PASSWORD_RESET_CONTINUE_URL',
				`${root}?mode=sign-in`,
			);
			const { callableSendTestEmailTemplate } =
				await loadEmailTemplateHandlers(createBackgroundAdminMock());
			sesSendMock.mockResolvedValue({ MessageId: 'preview' });
			await callableSendTestEmailTemplate(
				createCallableRequest(
					{ ...template, recipientEmail: 'qa@example.com' },
					{ roles: ['admin'] },
				),
			);
			const body = sesSendMock.mock.calls[0][0].input.Message.Body;
			expect(body.Html.Data).toContain(`href="${root}"`);
			expect(body.Text.Data).toContain(root);
			expect(body.Html.Data).not.toContain('{{');
			expect(body.Text.Data).not.toContain('{{');
			expect(body.Html.Data).toContain(
				`faq-${template.language === 'es' ? 'espanol' : 'english'}/`,
			);
			if (template.deliveryProfile === 'registration-cancellation') {
				expect(body.Html.Data).not.toContain('JOY26ABC');
				expect(body.Html.Data).toContain(
					template.language === 'es'
						? 'Inscribirme de nuevo'
						: 'Register again',
				);
			}
		},
	);

	it('converts legacy hardcoded links to runtime placeholders when publishing', async () => {
		const db = createBackgroundAdminMock();
		const template = packages.find(
			(item) =>
				item.template.language === 'en' &&
				item.template.deliveryProfile === 'registration-cancellation',
		)?.template;
		if (!template?.textPart)
			throw new Error('English cancellation starter is missing.');
		const html = template.html.replaceAll(
			'{{registrationUrl}}',
			'https://register.denversantaclausshop.org/',
		);
		const textPart = template.textPart.replaceAll(
			'{{registrationUrl}}',
			'https://santashop-app-test.web.app/',
		);
		const fields = template.fieldMappings.filter(
			(field) => field.name !== 'registrationUrl',
		);
		db.setDocSnapshot(`emailTemplates/${template.key}`, {
			...template,
			seasonalReviewRequired: false,
			currentRevisionId: 'legacy',
		});
		db.setDocSnapshot(`emailTemplates/${template.key}/revisions/legacy`, {
			...template,
			id: 'legacy',
			seasonalReviewRequired: false,
			fieldMappings: fields,
			textPart,
			htmlStoragePath: 'legacy.html',
		});
		// Use cancellation content, which has no seasonal venue draft markers.
		db.setFileContents('legacy.html', html);
		const { callablePublishEmailTemplate } =
			await loadEmailTemplateHandlers(db);
		sesSendMock.mockResolvedValue({});
		await callablePublishEmailTemplate(
			createCallableRequest({ key: template.key }, { roles: ['admin'] }),
		);
		const published = sesSendMock.mock.calls[0][0].input.Template;
		expect(published.HtmlPart).toContain('href="{{registrationUrl}}"');
		expect(published.TextPart).toContain('{{registrationUrl}}');
		expect(published.HtmlPart).not.toContain(
			'https://register.denversantaclausshop.org',
		);
		expect(published.TextPart).not.toContain(
			'https://santashop-app-test.web.app',
		);
	});
});
