import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadEmailTemplateHandlers,
	sesSendMock,
} from '../helpers/email-template.unit-helper';

describe('callablePublishEmailTemplate handler', () => {
	let backgroundMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
	});

	it('publishes a revision to SES with normalized html and updates publish markers', async () => {
		// Arrange
		const { callablePublishEmailTemplate } =
			await loadEmailTemplateHandlers(backgroundMock);
		backgroundMock.setDocSnapshot(
			'emailTemplates/registration-confirmation',
			{
				key: 'registration-confirmation',
				deliveryProfile: 'registration-confirmation',
				displayName: 'Registration Confirmation',
				description: 'Main registration email',
				subjectPart: 'Hello {{firstName}}',
				awsTemplateName: 'dscs-registration-confirmation-v1',
				fieldMappings: [
					{
						name: 'firstName',
						mapping: 'firstName',
						sampleValue: 'Buddy',
					},
					{
						name: 'qrCodeUrl',
						mapping: 'qrCodeUrl',
						sampleValue: 'https://example.com/test-qr.png',
					},
				],
				currentRevisionId: 'rev-1',
				currentRevisionNumber: 1,
				createdOn: new Date('2025-11-01T00:00:00.000Z'),
				updatedOn: new Date('2025-11-01T00:00:00.000Z'),
			},
		);
		backgroundMock.setDocSnapshot(
			'emailTemplates/registration-confirmation/revisions/rev-1',
			{
				id: 'rev-1',
				templateKey: 'registration-confirmation',
				deliveryProfile: 'registration-confirmation',
				revisionNumber: 1,
				subjectPart: 'Hello {{firstName}}',
				htmlStoragePath:
					'emailTemplates/registration-confirmation/revisions/rev-1.html',
				htmlFileName: 'registration-confirmation-revision-1.html',
				fieldMappings: [
					{
						name: 'firstName',
						mapping: 'firstName',
						sampleValue: 'Buddy',
					},
					{
						name: 'qrCodeUrl',
						mapping: 'qrCodeUrl',
						sampleValue: 'https://example.com/test-qr.png',
					},
				],
				createdOn: new Date('2025-11-01T00:00:00.000Z'),
			},
		);
		backgroundMock.setFileContents(
			'emailTemplates/registration-confirmation/revisions/rev-1.html',
			'<html><head></head><body><img src="{{qrCodeUrl}}" alt="qr code image"><h1>Hello {{firstName}}</h1></body></html>',
		);
		sesSendMock
			.mockRejectedValueOnce(
				Object.assign(new Error('missing template'), {
					name: 'TemplateDoesNotExistException',
				}),
			)
			.mockResolvedValueOnce({ $metadata: { httpStatusCode: 200 } });

		// Act
		const result = await callablePublishEmailTemplate(
			createCallableRequest(
				{ key: 'registration-confirmation' },
				{ roles: ['admin', 'checkin'] },
			),
		);

		// Assert
		expect(sesSendMock).toHaveBeenCalledTimes(2);
		expect(
			(
				sesSendMock.mock.calls[1]?.[0] as {
					input: { Template: { HtmlPart: string } };
				}
			).input.Template.HtmlPart,
		).toContain('<meta charset="utf-8">');
		expect(result.renderedHtml).toContain('{{firstName}}');
		expect(result.renderedHtml).toContain('src="{{qrCodeUrl}}"');
		expect(
			backgroundMock.getDocRef('emailTemplates/registration-confirmation')
				.set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				publishedRevisionId: 'rev-1',
				publishedRevisionNumber: 1,
			}),
			{ merge: true },
		);
	});

	it('maps invalid publish requests to invalid-argument errors', async () => {
		const { callablePublishEmailTemplate } =
			await loadEmailTemplateHandlers(backgroundMock);

		await expect(
			callablePublishEmailTemplate(
				createCallableRequest(
					{ key: 'Not Valid!' },
					{ roles: ['admin', 'checkin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects unsupported Handlebars syntax from a saved revision', async () => {
		const { callablePublishEmailTemplate } =
			await loadEmailTemplateHandlers(backgroundMock);
		backgroundMock.setDocSnapshot(
			'emailTemplates/registration-confirmation',
			{
				key: 'registration-confirmation',
				deliveryProfile: 'registration-confirmation',
				displayName: 'Registration Confirmation',
				awsTemplateName: 'dscs-registration-confirmation-v1',
				currentRevisionId: 'rev-1',
			},
		);
		backgroundMock.setDocSnapshot(
			'emailTemplates/registration-confirmation/revisions/rev-1',
			{
				id: 'rev-1',
				templateKey: 'registration-confirmation',
				deliveryProfile: 'registration-confirmation',
				revisionNumber: 1,
				subjectPart: '{{#if firstName}}Hello{{/if}}',
				htmlStoragePath:
					'emailTemplates/registration-confirmation/revisions/rev-1.html',
				fieldMappings: [],
			},
		);
		backgroundMock.setFileContents(
			'emailTemplates/registration-confirmation/revisions/rev-1.html',
			'<h1>Hello {{firstName}}</h1>',
		);

		await expect(
			callablePublishEmailTemplate(
				createCallableRequest(
					{ key: 'registration-confirmation' },
					{ roles: ['admin', 'checkin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects an unsupported delivery profile from a saved revision', async () => {
		const { callablePublishEmailTemplate } =
			await loadEmailTemplateHandlers(backgroundMock);
		backgroundMock.setDocSnapshot(
			'emailTemplates/registration-confirmation',
			{
				key: 'registration-confirmation',
				awsTemplateName: 'dscs-registration-confirmation-v1',
				currentRevisionId: 'rev-1',
			},
		);
		backgroundMock.setDocSnapshot(
			'emailTemplates/registration-confirmation/revisions/rev-1',
			{
				id: 'rev-1',
				deliveryProfile: 'unsupported-profile',
				subjectPart: 'Hello {{firstName}}',
				htmlStoragePath:
					'emailTemplates/registration-confirmation/revisions/rev-1.html',
				fieldMappings: [
					{
						name: 'firstName',
						mapping: 'firstName',
						sampleValue: 'Buddy',
					},
				],
			},
		);
		backgroundMock.setFileContents(
			'emailTemplates/registration-confirmation/revisions/rev-1.html',
			'<h1>Hello {{firstName}}</h1>',
		);

		await expect(
			callablePublishEmailTemplate(
				createCallableRequest(
					{ key: 'registration-confirmation' },
					{ roles: ['admin', 'checkin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('requires seasonal review, rejects remaining draft notes, and publishes plain text without replacing a newer draft', async () => {
		const { callablePublishEmailTemplate: publish } =
			await loadEmailTemplateHandlers(backgroundMock);
		const summary = {
			key: 'seasonal',
			language: 'es',
			deliveryProfile: 'event-reminder',
			awsTemplateName: 'seasonal-es',
			subjectPart: 'New unsaved publication draft',
			fieldMappings: [],
			currentRevisionId: 'r2',
			seasonalReviewRequired: true,
		};
		const revision = {
			id: 'r1',
			language: 'es',
			deliveryProfile: 'event-reminder',
			htmlStoragePath: 'template.html',
			subjectPart: 'Tu visita',
			textPart: 'Hola',
			fieldMappings: [],
			seasonalReviewRequired: true,
			seasonalDetailsReviewed: false,
		};
		backgroundMock.setDocSnapshot('emailTemplates/seasonal', summary);
		backgroundMock.setDocSnapshot(
			'emailTemplates/seasonal/revisions/r1',
			revision,
		);
		backgroundMock.setFileContents('template.html', '<p>POR CONFIRMAR</p>');
		const request = createCallableRequest(
			{ key: 'seasonal', revisionId: 'r1' },
			{ roles: ['admin'] },
		);
		await expect(publish(request)).rejects.toMatchObject({
			code: 'failed-precondition',
		});
		expect(sesSendMock).not.toHaveBeenCalled();
		backgroundMock.setDocSnapshot('emailTemplates/seasonal/revisions/r1', {
			...revision,
			seasonalDetailsReviewed: true,
		});
		await expect(publish(request)).rejects.toThrow(
			'Replace the unconfirmed',
		);
		backgroundMock.setFileContents('template.html', '<p>Hola</p>');
		await publish(request);
		expect(sesSendMock.mock.calls[0][0].input.Template).toMatchObject({
			SubjectPart: 'Tu visita',
			TextPart: 'Hola',
		});
		expect(
			backgroundMock.getDocRef('emailTemplates/seasonal').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				currentRevisionId: 'r2',
				subjectPart: 'New unsaved publication draft',
				publishedRevisionId: 'r1',
			}),
			{ merge: true },
		);
	});
});
