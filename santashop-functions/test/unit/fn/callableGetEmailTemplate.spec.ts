import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import { loadEmailTemplateHandlers } from '../helpers/email-template.unit-helper';

describe('callableGetEmailTemplate handler', () => {
	let backgroundMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
	});

	it('returns template metadata, revisions, and current html', async () => {
		const { callableGetEmailTemplate } =
			await loadEmailTemplateHandlers(backgroundMock);
		backgroundMock.setDocSnapshot('emailTemplates/registration-2026', {
			key: 'registration-2026',
			deliveryProfile: 'registration-confirmation',
			displayName: 'Registration 2026',
			subjectPart: 'Hello {{firstName}}',
			awsTemplateName: 'registration-2026',
			fieldMappings: [],
			currentRevisionId: 'rev-2',
			createdOn: new Date(),
			updatedOn: new Date(),
		});
		backgroundMock.setCollectionDocs(
			'emailTemplates/registration-2026/revisions',
			[
				{
					id: 'rev-2',
					data: {
						id: 'rev-2',
						templateKey: 'registration-2026',
						deliveryProfile: 'registration-confirmation',
						revisionNumber: 2,
						subjectPart: 'Hello {{firstName}}',
						htmlStoragePath:
							'emailTemplates/registration-2026/revisions/rev-2.html',
						htmlFileName: 'registration-2026-r2.html',
						fieldMappings: [],
						createdOn: new Date(),
					},
				},
			],
		);
		backgroundMock.setFileContents(
			'emailTemplates/registration-2026/revisions/rev-2.html',
			'<h1>Hello {{firstName}}</h1>',
		);

		const result = await callableGetEmailTemplate(
			createCallableRequest(
				{ key: 'registration-2026' },
				{ admin: true },
			),
		);

		expect(result.template.displayName).toBe('Registration 2026');
		expect(result.revisions).toHaveLength(1);
		expect(result.currentHtml).toContain('{{firstName}}');
	});

	it('maps invalid template keys to invalid-argument errors', async () => {
		const { callableGetEmailTemplate } =
			await loadEmailTemplateHandlers(backgroundMock);

		await expect(
			callableGetEmailTemplate(
				createCallableRequest({ key: 'Bad Key!' }, { admin: true }),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});
});
