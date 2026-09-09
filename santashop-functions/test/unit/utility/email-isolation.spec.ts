import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import { createCallableRequest } from '../../helpers/callable-context';

describe('isolated test email delivery', () => {
	let background: ReturnType<typeof createBackgroundAdminMock>;
	const constructSes = vi.fn();
	beforeEach(() => {
		vi.resetModules();
		background = createBackgroundAdminMock();
		vi.doMock('firebase-admin', () => background.module);
		vi.doMock('@aws-sdk/client-ses', () => ({
			SESClient: class {
				constructor() {
					constructSes();
					throw new Error('SES must never be constructed.');
				}
			},
			SendEmailCommand: class {
				constructor(public readonly input: unknown) {}
			},
			SendTemplatedEmailCommand: class {
				constructor(public readonly input: unknown) {}
			},
			CreateTemplateCommand: class {
				constructor(public readonly input: unknown) {}
			},
			UpdateTemplateCommand: class {
				constructor(public readonly input: unknown) {}
			},
		}));
		vi.stubEnv('SANTASHOP_EMAIL_TRANSPORT', 'sink');
		vi.stubEnv('GCLOUD_PROJECT', 'santas-workshop-test');
		vi.stubEnv('GCP_PROJECT', 'santas-workshop-test');
		vi.stubEnv(
			'FIREBASE_CONFIG',
			JSON.stringify({ projectId: 'santas-workshop-test' }),
		);
		for (const key of Object.keys(process.env).filter((key) =>
			key.startsWith('AWS_'),
		))
			vi.stubEnv(key, undefined);
		constructSes.mockClear();
	});
	afterEach(() => vi.unstubAllEnvs());

	it('rejects production, conflicting project identity, credentials, and unknown modes', async () => {
		const { isEmailSink } =
			await import('../../../src/utility/email-isolation');
		expect(isEmailSink()).toBe(true);
		vi.stubEnv('GCP_PROJECT', 'santas-workshop-193b5');
		expect(isEmailSink).toThrow('restricted');
		vi.stubEnv('GCP_PROJECT', 'santas-workshop-test');
		vi.stubEnv('AWS_WEB_IDENTITY_TOKEN_FILE', '/unexpected');
		expect(isEmailSink).toThrow('AWS configuration');
		vi.stubEnv('AWS_WEB_IDENTITY_TOKEN_FILE', undefined);
		vi.stubEnv('SANTASHOP_EMAIL_TRANSPORT', 'typo');
		expect(isEmailSink).toThrow('Unknown email transport');
	});

	it('stores hash-only simulated receipts without recipients, links, or provider acceptance', async () => {
		const { recordSimulatedEmail } =
			await import('../../../src/utility/email-isolation');
		await recordSimulatedEmail(
			'password-reset',
			{ secret: 'reset-link', email: 'person@example.com' },
			'receipt',
		);
		const write = background.getDocRef(
			'emailSinkReceipts/password-reset-receipt',
		).set.mock.calls[0][0];
		expect(write).toMatchObject({
			simulated: true,
			provider: 'test-sink',
			contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
			contentBytes: expect.any(Number),
		});
		expect(JSON.stringify(write)).not.toMatch(
			/reset-link|person@example.com|AcceptedOn|MessageId/,
		);
		expect(constructSes).not.toHaveBeenCalled();
	});

	it('finishes a queued cancellation as simulated and never constructs SES', async () => {
		const cancelledOn = new Date('2025-12-01');
		background.setDocSnapshot('registrations/parent', {
			uid: 'parent',
			qrcode: 'ABCD2345',
			firstName: 'Parent',
			emailAddress: 'parent@example.com',
			cancelledOn,
			cancellationLogId: 'cancel',
		});
		const queued = {
			registrationUid: 'parent',
			queueSource: 'registration-cancellation',
			cancellationLogId: 'cancel',
			code: 'ABCD2345',
			name: 'Parent',
			email: 'parent@example.com',
			formattedDateTime: 'December 12',
			deliveryState: 'queued',
		};
		background.setDocSnapshot('tmp_registrationemails/message', queued);
		const { default: send } =
			await import('../../../src/fn/sendRegistrationEmail');
		await send({ id: 'message', data: () => queued } as never);
		expect(
			background.getDocRef('tmp_registrationemails/message').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'simulated',
				deliverySinkReceiptId: 'registration-message',
			}),
			{ merge: true },
		);
		expect(constructSes).not.toHaveBeenCalled();
		expect(
			background.getDocRef('registrations/parent').set,
		).not.toHaveBeenCalled();
	});

	it('does not replay a simulated queue document after changing the transport', async () => {
		background.setDocSnapshot('tmp_registrationemails/message', {
			registrationUid: 'parent',
			deliveryState: 'simulated',
		});
		vi.stubEnv('SANTASHOP_EMAIL_TRANSPORT', 'ses');
		const { default: send } =
			await import('../../../src/fn/sendRegistrationEmail');
		await send({
			id: 'message',
			data: () => ({
				registrationUid: 'parent',
				deliveryState: 'simulated',
			}),
		} as never);
		expect(constructSes).not.toHaveBeenCalled();
		expect(
			background.getDocRef('tmp_registrationemails/message').set,
		).not.toHaveBeenCalled();
	});

	it('suppresses the direct password reset path', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
		background.getUserByEmail.mockResolvedValue({ uid: 'parent' });
		background.generatePasswordResetLink.mockResolvedValue(
			'https://example.com/reset?oobCode=secret',
		);
		background.setDocSnapshot('users/parent', { preferredLanguage: 'en' });
		const { default: reset } =
			await import('../../../src/fn/requestPasswordReset');
		await expect(
			reset(
				createCallableRequest({ emailAddress: 'parent@example.com' }),
			),
		).resolves.toEqual({ accepted: true });
		expect(constructSes).not.toHaveBeenCalled();
	});

	it('suppresses direct template test mail after rendering', async () => {
		const { default: send } =
			await import('../../../src/fn/callableSendTestEmailTemplate');
		const result = await send(
			createCallableRequest(
				{
					recipientEmail: 'parent@example.com',
					deliveryProfile: 'registration-confirmation',
					subjectPart: 'Hello {{firstName}}',
					html: '<p>{{firstName}}</p>',
					fieldMappings: [
						{
							name: 'firstName',
							mapping: 'firstName',
							sampleValue: 'Parent',
						},
					],
				},
				{ roles: ['admin'] },
			),
		);
		expect(result.renderedSubject).toBe('Hello Parent');
		expect(constructSes).not.toHaveBeenCalled();
	});

	it('publishes a local revision without constructing an AWS template client', async () => {
		const mappings = [
			{ name: 'firstName', mapping: 'firstName', sampleValue: 'Parent' },
			{
				name: 'qrCodeUrl',
				mapping: 'qrCodeUrl',
				sampleValue: 'https://example.com/qr.png',
			},
		];
		background.setDocSnapshot('emailTemplates/registration-confirmation', {
			key: 'registration-confirmation',
			deliveryProfile: 'registration-confirmation',
			displayName: 'Confirmation',
			awsTemplateName: 'confirmation',
			currentRevisionId: 'rev-1',
			currentRevisionNumber: 1,
			fieldMappings: mappings,
		});
		background.setDocSnapshot(
			'emailTemplates/registration-confirmation/revisions/rev-1',
			{
				id: 'rev-1',
				templateKey: 'registration-confirmation',
				deliveryProfile: 'registration-confirmation',
				revisionNumber: 1,
				subjectPart: 'Hello {{firstName}}',
				htmlStoragePath: 'templates/rev-1.html',
				fieldMappings: mappings,
			},
		);
		background.setFileContents(
			'templates/rev-1.html',
			'<p>Hello {{firstName}}</p><img src="{{qrCodeUrl}}" alt="QR">',
		);
		const { default: publish } =
			await import('../../../src/fn/callablePublishEmailTemplate');
		await publish(
			createCallableRequest(
				{ key: 'registration-confirmation' },
				{ roles: ['admin'] },
			),
		);
		expect(
			background.getDocRef('emailTemplates/registration-confirmation')
				.set,
		).toHaveBeenCalledWith(
			expect.objectContaining({ publishedRevisionId: 'rev-1' }),
			{ merge: true },
		);
		expect(constructSes).not.toHaveBeenCalled();
	});

	it('renders the published confirmation revision before recording simulated completion', async () => {
		const mappings = [
			{ name: 'firstName', mapping: 'firstName', sampleValue: 'Sample' },
		];
		background.setDocSnapshot('emailTemplates/confirmation', {
			key: 'confirmation',
			awsTemplateName: 'confirmation',
			publishedRevisionId: 'rev-1',
			fieldMappings: mappings,
		});
		background.setDocSnapshot(
			'emailTemplates/confirmation/revisions/rev-1',
			{
				subjectPart: 'Hello {{firstName}}',
				textPart: 'Welcome {{firstName}}',
				htmlStoragePath: 'templates/rev-1.html',
				fieldMappings: mappings,
			},
		);
		background.setFileContents(
			'templates/rev-1.html',
			'<p>Hello {{firstName}}</p>',
		);
		background.setDocSnapshot('registrations/parent', {
			uid: 'parent',
			qrcode: 'ABCD2345',
			qrCodeStoragePath: 'registrations/parent/qr.png',
			firstName: 'Parent',
			emailAddress: 'parent@example.com',
			registrationSubmittedOn: new Date('2025-12-01'),
			reminderEmailQueuedOn: new Date('2025-12-01'),
			dateTimeSlot: { id: 'slot' },
		});
		const queued = {
			registrationUid: 'parent',
			deliveryRequestedOn: new Date('2025-12-01'),
			code: 'ABCD2345',
			qrCodeStoragePath: 'registrations/parent/qr.png',
			name: 'Parent',
			email: 'parent@example.com',
			formattedDateTime: 'December 12',
			templateKey: 'confirmation',
			deliveryState: 'queued',
		};
		background.setDocSnapshot('tmp_registrationemails/message', queued);
		const { default: send } =
			await import('../../../src/fn/sendRegistrationEmail');
		await send({ id: 'message', data: () => queued } as never);
		expect(
			background.getFileRef('templates/rev-1.html').download,
		).toHaveBeenCalled();
		expect(
			background.getDocRef('tmp_registrationemails/message').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({ deliveryState: 'simulated' }),
			{ merge: true },
		);
		const { createHash } = await import('node:crypto');
		const content = JSON.stringify({
			subject: 'Hello Parent',
			html: '<p>Hello Parent</p>',
			text: 'Welcome Parent',
		});
		expect(
			background.getDocRef('emailSinkReceipts/registration-message').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				contentSha256: createHash('sha256')
					.update(content)
					.digest('hex'),
			}),
		);
		expect(constructSes).not.toHaveBeenCalled();
	});
});
