import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadEmailTemplateHandlers,
	sesSendMock,
} from '../helpers/email-template.unit-helper';

describe('callableSendTestEmailTemplate handler', () => {
	let backgroundMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
	});

	it('rejects non-admin callers', async () => {
		const { callableSendTestEmailTemplate } =
			await loadEmailTemplateHandlers(backgroundMock);

		await expect(
			callableSendTestEmailTemplate(
				createCallableRequest(
					{
						recipientEmail: 'preview@example.com',
						deliveryProfile: 'registration-confirmation',
						subjectPart: 'Hello {{firstName}}',
						html: '<h1>Hello {{firstName}}</h1>',
						fieldMappings: [],
					},
					{ admin: false },
				),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('renders the draft subject/html with test values and sends a direct HTML email', async () => {
		const { callableSendTestEmailTemplate } =
			await loadEmailTemplateHandlers(backgroundMock);
		sesSendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });

		const result = await callableSendTestEmailTemplate(
			createCallableRequest(
				{
					recipientEmail: 'preview@example.com',
					deliveryProfile: 'registration-confirmation',
					subjectPart: 'Ticket for {{eventName}}',
					html: '<html><head></head><body><img src="https://example.com/original.png" alt="qr code image"><h1>Hello {{contact.firstName}}</h1></body></html>',
					fieldMappings: [
						{
							name: 'contact.firstName',
							mapping: 'firstName',
							sampleValue: 'Buddy',
						},
						{
							name: 'eventName',
							mapping: 'eventName',
							sampleValue: 'Toy Drive',
						},
						{
							name: 'qrCodeUrl',
							mapping: 'qrCodeUrl',
							sampleValue:
								'https://example.com/test-qr.png',
						},
					],
				},
				{ admin: true },
			),
		);

		expect(result.renderedSubject).toBe('Ticket for Toy Drive');
		expect(result.renderedHtml).toContain('Hello Buddy');
		expect(result.renderedHtml).toContain(
			'src="https://example.com/test-qr.png"',
		);
		expect(
			(sesSendMock.mock.calls[0]?.[0] as {
				input: {
					Destination: { ToAddresses: string[] };
					Message: {
						Subject: { Data: string };
						Body: { Html: { Data: string } };
					};
				};
			}).input,
		).toEqual(
			expect.objectContaining({
				Destination: { ToAddresses: ['preview@example.com'] },
				Message: expect.objectContaining({
					Subject: { Charset: 'UTF-8', Data: 'Ticket for Toy Drive' },
				}),
			}),
		);
	});
});