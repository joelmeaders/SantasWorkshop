import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadTriggerScheduledHandlers,
	sesSendMock,
	type TriggerScheduledAdminMock,
} from '../helpers/trigger-scheduled.unit-helper';

describe('sendNewRegistrationEmails2 handler', () => {
	let backgroundMock: TriggerScheduledAdminMock;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.batchCommit.mockResolvedValue(undefined);
		backgroundMock.exportDocuments.mockResolvedValue([{ name: 'op-123' }]);
	});

	it('marks queued registration email docs as sent after a successful send', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		sesSendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-1', {
			code: 'ABCD2345',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
		});
		backgroundMock.setDocSnapshot('registrations/user-1', {}, true);
		backgroundMock
			.getDocRef('registrations/user-1')
			.set.mockResolvedValue(undefined);
		backgroundMock
			.getDocRef('tmp_registrationemails/user-1')
			.set.mockResolvedValue(undefined);

		await sendNewRegistrationEmails({
			id: 'user-1',
			data: () => ({
				code: 'ABCD2345',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			}),
		} as never);

		expect(sesSendMock).toHaveBeenCalledTimes(1);
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'sent',
				deliveryCompletedOn: expect.any(Date),
			}),
			{ merge: true },
		);
		expect(
			backgroundMock.getDocRef('registrations/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				reminderEmailSentOn: expect.any(Date),
				reminderEmailFailedOn: false,
			}),
			{ merge: true },
		);
	});

	it('does not resend when registration is already marked as sent', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-1', {
			code: 'ABCD2345',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			{
				reminderEmailSentOn: new Date('2025-12-01T00:00:00.000Z'),
			},
			true,
		);
		backgroundMock
			.getDocRef('tmp_registrationemails/user-1')
			.set.mockResolvedValue(undefined);

		await sendNewRegistrationEmails({
			id: 'user-1',
			data: () => ({
				code: 'ABCD2345',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			}),
		} as never);

		expect(sesSendMock).not.toHaveBeenCalled();
	});

	it('records failure metadata and throws when SES send fails', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		sesSendMock.mockRejectedValue(new Error('SES failure'));
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-1', {
			code: 'ABCD2345',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
		});
		backgroundMock.setDocSnapshot('registrations/user-1', {}, true);
		backgroundMock
			.getDocRef('registrations/user-1')
			.set.mockResolvedValue(undefined);
		backgroundMock
			.getDocRef('tmp_registrationemails/user-1')
			.set.mockResolvedValue(undefined);

		await expect(
			sendNewRegistrationEmails({
				id: 'user-1',
				data: () => ({
					code: 'ABCD2345',
					name: 'Buddy',
					email: 'buddy.elf@example.com',
					formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				}),
			} as never),
		).rejects.toThrow('SES failure');

		expect(
			backgroundMock.getDocRef('registrations/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				reminderEmailFailedOn: expect.any(Date),
			}),
			{ merge: true },
		);
	});

	it('requeues stale sending documents instead of abandoning them forever', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		sesSendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-2', {
			code: 'WXYZ6789',
			name: 'Noelle',
			email: 'noelle.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			deliveryState: 'sending',
			deliveryAttemptedOn: new Date(Date.now() - 16 * 60 * 1000),
		});
		backgroundMock.setDocSnapshot('registrations/user-2', {}, true);
		backgroundMock
			.getDocRef('registrations/user-2')
			.set.mockResolvedValue(undefined);
		backgroundMock
			.getDocRef('tmp_registrationemails/user-2')
			.set.mockResolvedValue(undefined);

		await sendNewRegistrationEmails({
			id: 'user-2',
			data: () => ({
				code: 'WXYZ6789',
				name: 'Noelle',
				email: 'noelle.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				deliveryState: 'sending',
				deliveryAttemptedOn: new Date(Date.now() - 16 * 60 * 1000),
			}),
		} as never);

		expect(sesSendMock).toHaveBeenCalledTimes(1);
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/user-2').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'queued',
				lastErrorMessage: false,
			}),
			{ merge: true },
		);
	});

	it('preserves a sent queue marker when registration persistence fails after SES succeeds', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		sesSendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-1', {
			code: 'ABCD2345',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			deliveryState: 'queued',
		});
		backgroundMock.setDocSnapshot('registrations/user-1', {}, true);
		backgroundMock
			.getDocRef('registrations/user-1')
			.set.mockRejectedValueOnce(new Error('registration write failed'));
		backgroundMock
			.getDocRef('tmp_registrationemails/user-1')
			.set.mockResolvedValue(undefined);

		await expect(
			sendNewRegistrationEmails({
				id: 'user-1',
				data: () => ({
					code: 'ABCD2345',
					name: 'Buddy',
					email: 'buddy.elf@example.com',
					formattedDateTime: 'Wednesday, December 10, 6:00 PM',
					deliveryState: 'queued',
				}),
			} as never),
		).rejects.toThrow('registration write failed');

		expect(
			backgroundMock.getDocRef('tmp_registrationemails/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'sent',
				deliveryCompletedOn: expect.any(Date),
			}),
			{ merge: true },
		);
		expect(
			backgroundMock.getDocRef('registrations/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				reminderEmailSentOn: expect.any(Date),
			}),
			{ merge: true },
		);

		backgroundMock.setDocSnapshot(
			'tmp_registrationemails/user-1',
			{
				code: 'ABCD2345',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				deliveryState: 'sent',
				deliveryCompletedOn: new Date('2025-12-10T18:00:00.000Z'),
			},
			true,
		);
		backgroundMock.setDocSnapshot('registrations/user-1', {}, true);
		backgroundMock
			.getDocRef('registrations/user-1')
			.set.mockResolvedValue(undefined);
		sesSendMock.mockClear();

		await sendNewRegistrationEmails({
			id: 'user-1',
			data: () => ({
				code: 'ABCD2345',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				deliveryState: 'sent',
			}),
		} as never);

		expect(sesSendMock).not.toHaveBeenCalled();
		expect(
			backgroundMock.getDocRef('registrations/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				reminderEmailSentOn: expect.any(Date),
			}),
			{ merge: true },
		);
	});

	it('resolves a published template name from the logical template key', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		sesSendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-3', {
			code: 'REM12345',
			name: 'Noelle',
			email: 'noelle.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'event-reminder',
		});
		backgroundMock.setDocSnapshot('registrations/user-3', {}, true);
		backgroundMock.setCollectionDocs('emailTemplates', [
			{
				id: 'special-reminder-2026',
				data: {
					key: 'special-reminder-2026',
					deliveryProfile: 'event-reminder',
					displayName: 'Event Reminder',
					subjectPart: 'Reminder',
					awsTemplateName: 'custom-event-reminder-v2',
					fieldMappings: [
						{
							name: 'guestName',
							mapping: 'firstName',
							sampleValue: 'Noelle',
						},
					],
					publishedRevisionId: 'rev-3',
					publishedRevisionNumber: 3,
					publishedOn: new Date('2025-11-02T00:00:00.000Z'),
					createdOn: new Date('2025-11-01T00:00:00.000Z'),
					updatedOn: new Date('2025-11-02T00:00:00.000Z'),
				},
			},
		]);
		backgroundMock.getDocRef('registrations/user-3').set.mockResolvedValue(undefined);
		backgroundMock.getDocRef('tmp_registrationemails/user-3').set.mockResolvedValue(undefined);

		await sendNewRegistrationEmails({
			id: 'user-3',
			data: () => ({
				code: 'REM12345',
				name: 'Noelle',
				email: 'noelle.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'event-reminder',
			}),
		} as never);

		expect(
			(sesSendMock.mock.calls[0]?.[0] as {
				input: { Template: string };
			}).input.Template,
		).toBe('custom-event-reminder-v2');
		expect(
			JSON.parse(
				(sesSendMock.mock.calls[0]?.[0] as {
					input: { TemplateData: string };
				}).input.TemplateData,
			),
		).toEqual(
			expect.objectContaining({
				guestName: 'Noelle',
				firstName: 'Noelle',
			}),
		);
	});
});
