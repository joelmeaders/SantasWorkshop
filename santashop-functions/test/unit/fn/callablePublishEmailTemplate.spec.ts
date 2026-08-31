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
				],
				createdOn: new Date('2025-11-01T00:00:00.000Z'),
			},
		);
		backgroundMock.setFileContents(
			'emailTemplates/registration-confirmation/revisions/rev-1.html',
			'<html><head></head><body><img src="https://example.com/original.png" alt="qr code image"><h1>Hello {{contact.firstName}}</h1></body></html>',
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
				{ admin: true },
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
				createCallableRequest({ key: 'Not Valid!' }, { admin: true }),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});
});
