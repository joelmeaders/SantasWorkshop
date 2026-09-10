import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import { createCallableRequest } from '../../helpers/callable-context';

const enabled = vi.fn();
const send = vi.fn();
const construct = vi.fn();
let background: ReturnType<typeof createBackgroundAdminMock>;

describe('email sender disable control', () => {
	beforeEach(() => {
		vi.resetModules();
		background = createBackgroundAdminMock();
		enabled.mockReset().mockResolvedValue(false);
		send.mockReset().mockResolvedValue({ MessageId: 'mock-accepted' });
		construct.mockReset();
		vi.doMock('firebase-admin', () => background.module);
		vi.doMock('../../../src/utility/email-sending', () => ({
			isEmailSendingEnabled: enabled,
		}));
		vi.doMock('@aws-sdk/client-ses', () => ({
			SESClient: class {
				public send = send;
				constructor() {
					construct();
				}
			},
			SendEmailCommand: class {
				constructor(public readonly input: unknown) {}
			},
			SendTemplatedEmailCommand: class {
				constructor(public readonly input: unknown) {}
			},
		}));
	});

	it('suppresses queued mail without marking it sent and never replays it after re-enabling', async () => {
		const cancellation = new Date('2025-12-01');
		background.setDocSnapshot('registrations/parent', {
			uid: 'parent',
			qrcode: 'ABCD2345',
			firstName: 'Parent',
			emailAddress: 'parent@example.com',
			cancelledOn: cancellation,
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
		const { default: handler } =
			await import('../../../src/fn/sendRegistrationEmail');
		await handler({ id: 'message', data: () => queued } as never);
		expect(
			background.getDocRef('tmp_registrationemails/message').update,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'suppressed',
				deliverySuppressionReason: 'email-sending-disabled',
			}),
		);
		expect(construct).not.toHaveBeenCalled();
		expect(
			background.getDocRef('registrations/parent').set,
		).not.toHaveBeenCalled();
		expect(
			background.getDocRef('tmp_registrationemails/message').set,
		).not.toHaveBeenCalled();
		enabled.mockResolvedValue(true);
		background.setDocSnapshot('tmp_registrationemails/message', {
			...queued,
			deliveryState: 'suppressed',
		});
		await handler({ id: 'message', data: () => queued } as never);
		expect(send).not.toHaveBeenCalled();
	});

	it('rechecks permission after rendering before calling SES', async () => {
		enabled.mockResolvedValueOnce(true).mockResolvedValue(false);
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
		background.setDocSnapshot('registrations/parent', {
			uid: 'parent',
			qrcode: 'ABCD2345',
			firstName: 'Parent',
			emailAddress: 'parent@example.com',
			cancelledOn: new Date('2025-12-01'),
			cancellationLogId: 'cancel',
		});
		background.setDocSnapshot('tmp_registrationemails/message', queued);
		const { default: handler } =
			await import('../../../src/fn/sendRegistrationEmail');
		await handler({ id: 'message', data: () => queued } as never);
		expect(enabled).toHaveBeenCalledTimes(2);
		expect(send).not.toHaveBeenCalled();
		expect(
			background.getDocRef('tmp_registrationemails/message').update,
		).toHaveBeenCalledWith(
			expect.objectContaining({ deliveryState: 'suppressed' }),
		);
	});

	it('keeps the password-reset acknowledgement generic while suppressing SES', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
		background.getUserByEmail.mockResolvedValue({ uid: 'parent' });
		background.generatePasswordResetLink.mockResolvedValue(
			'https://example.com/reset',
		);
		background.setDocSnapshot('users/parent', { preferredLanguage: 'en' });
		const { default: handler } =
			await import('../../../src/fn/requestPasswordReset');
		try {
			expect(
				await handler(
					createCallableRequest({
						emailAddress: 'parent@example.com',
					}),
				),
			).toEqual({ accepted: true });
			expect(enabled).toHaveBeenCalled();
			expect(construct).not.toHaveBeenCalled();
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it('tells an admin that a test email was blocked instead of claiming success', async () => {
		const { default: handler } =
			await import('../../../src/fn/callableSendTestEmailTemplate');
		await expect(
			handler(
				createCallableRequest(
					{
						recipientEmail: 'preview@example.com',
						deliveryProfile: 'registration-confirmation',
						subjectPart: 'Ticket for {{eventName}}',
						html: '<img src="{{qrCodeUrl}}"><p>{{firstName}}</p>',
						fieldMappings: [
							{
								name: 'firstName',
								mapping: 'firstName',
								sampleValue: 'Parent',
							},
							{
								name: 'eventName',
								mapping: 'eventName',
								sampleValue: 'Event',
							},
							{
								name: 'qrCodeUrl',
								mapping: 'qrCodeUrl',
								sampleValue: 'https://example.com/qr.png',
							},
						],
					},
					{ roles: ['admin'] },
				),
			),
		).rejects.toMatchObject({
			code: 'failed-precondition',
			message: 'Email sending is disabled. No email was sent.',
		});
		expect(construct).not.toHaveBeenCalled();
	});
});
