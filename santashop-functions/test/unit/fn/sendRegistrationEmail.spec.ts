import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadTriggerScheduledHandlers,
	sesSendMock,
	type TriggerScheduledAdminMock,
} from '../helpers/trigger-scheduled.unit-helper';

describe('sendRegistrationEmail handler', () => {
	let backgroundMock: TriggerScheduledAdminMock;
	const activeRegistration = (
		uid: string,
		code: string,
		firstName: string,
		emailAddress: string,
		overrides: Record<string, unknown> = {},
	): Record<string, unknown> => ({
		uid,
		registrationSubmittedOn: new Date('2025-12-01T00:00:00.000Z'),
		qrcode: code,
		qrCodeStoragePath: `registrations/${uid}/test-asset.png`,
		firstName,
		emailAddress,
		dateTimeSlot: { id: 'slot-1' },
		...overrides,
	});

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.setDocSnapshot('emailTemplates/confirmation', {
			key: 'confirmation',
			awsTemplateName: 'confirmation-published',
			publishedRevisionId: 'revision-1',
			fieldMappings: [],
		});
		backgroundMock.setDocSnapshot(
			'emailTemplates/confirmation/revisions/revision-1',
			{ fieldMappings: [] },
		);
		backgroundMock.batchCommit.mockResolvedValue(undefined);
		backgroundMock.exportDocuments.mockResolvedValue([{ name: 'op-123' }]);
	});

	it('marks queued registration email docs as sent after a successful send', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		sesSendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-1', {
			code: 'ABCD2345',
			qrCodeStoragePath: 'registrations/user-1/test-asset.png',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'ABCD2345',
				'Buddy',
				'buddy.elf@example.com',
			),
		);
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
				qrCodeStoragePath: 'registrations/user-1/test-asset.png',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'confirmation',
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

	it('routes an immutable queue document to its registration owner', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		sesSendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		const queuedOn = new Date('2025-12-01T01:00:00.000Z');
		backgroundMock.setDocSnapshot(
			'tmp_registrationemails/email-request-1',
			{
				registrationUid: 'user-1',
				code: 'ABCD2345',
				qrCodeStoragePath: 'registrations/user-1/test-asset.png',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				appointmentSlotId: 'slot-1',
				templateKey: 'confirmation',
				deliveryRequestedOn: queuedOn,
				deliveryState: 'queued',
			},
		);
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'ABCD2345',
				'Buddy',
				'buddy.elf@example.com',
				{ reminderEmailQueuedOn: queuedOn },
			),
		);

		await sendNewRegistrationEmails({
			id: 'email-request-1',
			data: () => ({ registrationUid: 'user-1' }),
		} as never);

		expect(sesSendMock).toHaveBeenCalledTimes(1);
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/email-request-1')
				.set,
		).toHaveBeenCalledWith(
			expect.objectContaining({ deliveryState: 'sent' }),
			{ merge: true },
		);
		expect(
			backgroundMock.getDocRef('registrations/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({ reminderEmailSentOn: expect.any(Date) }),
			{ merge: true },
		);
	});

	it('marks an outdated appointment email as superseded', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setDocSnapshot(
			'tmp_registrationemails/email-request-old',
			{
				registrationUid: 'user-1',
				code: 'ABCD2345',
				qrCodeStoragePath: 'registrations/user-1/test-asset.png',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				appointmentSlotId: 'slot-old',
				templateKey: 'confirmation',
				deliveryState: 'queued',
			},
		);
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'ABCD2345',
				'Buddy',
				'buddy.elf@example.com',
				{ dateTimeSlot: { id: 'slot-new' } },
			),
		);

		await sendNewRegistrationEmails({
			id: 'email-request-old',
			data: () => ({ registrationUid: 'user-1' }),
		} as never);

		expect(sesSendMock).not.toHaveBeenCalled();
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/email-request-old')
				.set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'superseded',
				deliveryRequiresReviewReason:
					expect.stringContaining('newer appointment'),
			}),
			{ merge: true },
		);
	});

	it('supersedes a legacy queue document whose confirmation code is obsolete', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-1', {
			code: 'OLDCODE1',
			qrCodeStoragePath: 'registrations/user-1/test-asset.png',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'NEWCODE1',
				'Buddy',
				'buddy.elf@example.com',
			),
		);

		await sendNewRegistrationEmails({
			id: 'user-1',
			data: () => ({ code: 'OLDCODE1' }),
		} as never);

		expect(sesSendMock).not.toHaveBeenCalled();
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'superseded',
				deliveryRequiresReviewReason:
					expect.stringContaining('confirmation code'),
			}),
			{ merge: true },
		);
	});

	it('supersedes a queued email after the registration recipient changes', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		const queuedOn = new Date('2025-12-01T01:00:00.000Z');
		backgroundMock.setDocSnapshot(
			'tmp_registrationemails/email-request-2',
			{
				registrationUid: 'user-1',
				code: 'ABCD2345',
				qrCodeStoragePath: 'registrations/user-1/test-asset.png',
				name: 'Buddy',
				email: 'old@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				appointmentSlotId: 'slot-1',
				templateKey: 'confirmation',
				deliveryRequestedOn: queuedOn,
				deliveryState: 'queued',
			},
		);
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'ABCD2345',
				'Buddy',
				'new@example.com',
				{ reminderEmailQueuedOn: queuedOn },
			),
		);

		await sendNewRegistrationEmails({
			id: 'email-request-2',
			data: () => ({ registrationUid: 'user-1' }),
		} as never);

		expect(sesSendMock).not.toHaveBeenCalled();
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/email-request-2')
				.set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'superseded',
				deliveryRequiresReviewReason:
					expect.stringContaining('email address'),
			}),
			{ merge: true },
		);
	});

	it('sends a cancellation from its own queue document', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		sesSendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		backgroundMock.setDocSnapshot(
			'tmp_registrationemails/cancellation-request-1',
			{
				registrationUid: 'user-1',
				cancellationLogId: 'cancellation-1',
				code: 'NEWC1234',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				queueSource: 'registration-cancellation',
				deliveryState: 'queued',
			},
		);
		backgroundMock.setDocSnapshot('registrations/user-1', {
			cancelledOn: new Date('2025-12-02T00:00:00.000Z'),
			cancellationLogId: 'cancellation-1',
			qrcode: 'NEWC1234',
			firstName: 'Buddy',
			emailAddress: 'buddy.elf@example.com',
		});

		await sendNewRegistrationEmails({
			id: 'cancellation-request-1',
			data: () => ({ registrationUid: 'user-1' }),
		} as never);

		expect(sesSendMock).toHaveBeenCalledTimes(1);
		expect(
			(
				sesSendMock.mock.calls[0]?.[0] as {
					input: { Message: { Subject: { Data: string } } };
				}
			).input.Message.Subject.Data,
		).toContain('cancelled');
		expect(
			backgroundMock.getDocRef('registrations/user-1').set,
		).not.toHaveBeenCalled();
	});

	it('does not send when another worker claims the queue document first', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		const queuedDocument = {
			code: 'RACE1234',
			qrCodeStoragePath: 'registrations/user-6/test-asset.png',
			name: 'Holly',
			email: 'holly.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
			deliveryState: 'queued',
		};
		backgroundMock
			.getDocRef('tmp_registrationemails/user-6')
			.get.mockResolvedValueOnce({
				exists: true,
				data: () => queuedDocument,
			})
			.mockResolvedValueOnce({
				exists: true,
				data: () => ({ ...queuedDocument, deliveryState: 'sending' }),
			});
		backgroundMock.setDocSnapshot(
			'registrations/user-6',
			activeRegistration(
				'user-6',
				'RACE1234',
				'Holly',
				'holly.elf@example.com',
			),
		);

		await sendNewRegistrationEmails({
			id: 'user-6',
			data: () => queuedDocument,
		} as never);

		expect(sesSendMock).not.toHaveBeenCalled();
	});

	it('does not resend when registration is already marked as sent', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-1', {
			code: 'ABCD2345',
			qrCodeStoragePath: 'registrations/user-1/test-asset.png',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'ABCD2345',
				'Buddy',
				'buddy.elf@example.com',
				{ reminderEmailSentOn: new Date('2025-12-01T00:00:00.000Z') },
			),
		);
		backgroundMock
			.getDocRef('tmp_registrationemails/user-1')
			.set.mockResolvedValue(undefined);

		await sendNewRegistrationEmails({
			id: 'user-1',
			data: () => ({
				code: 'ABCD2345',
				qrCodeStoragePath: 'registrations/user-1/test-asset.png',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'confirmation',
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
			qrCodeStoragePath: 'registrations/user-1/test-asset.png',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'ABCD2345',
				'Buddy',
				'buddy.elf@example.com',
			),
		);
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
					qrCodeStoragePath: 'registrations/user-1/test-asset.png',
					name: 'Buddy',
					email: 'buddy.elf@example.com',
					formattedDateTime: 'Wednesday, December 10, 6:00 PM',
					templateKey: 'confirmation',
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
			qrCodeStoragePath: 'registrations/user-2/test-asset.png',
			name: 'Noelle',
			email: 'noelle.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
			deliveryState: 'sending',
			deliveryAttemptedOn: new Date(Date.now() - 16 * 60 * 1000),
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-2',
			activeRegistration(
				'user-2',
				'WXYZ6789',
				'Noelle',
				'noelle.elf@example.com',
			),
		);
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
				qrCodeStoragePath: 'registrations/user-2/test-asset.png',
				name: 'Noelle',
				email: 'noelle.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'confirmation',
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
		sesSendMock.mockResolvedValue({
			MessageId: 'msg-123',
			$metadata: { httpStatusCode: 200 },
		});
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-1', {
			code: 'ABCD2345',
			qrCodeStoragePath: 'registrations/user-1/test-asset.png',
			name: 'Buddy',
			email: 'buddy.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
			deliveryState: 'queued',
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'ABCD2345',
				'Buddy',
				'buddy.elf@example.com',
			),
		);
		const transactionImplementation =
			backgroundMock.runTransaction.getMockImplementation();
		if (!transactionImplementation) {
			throw new Error('Transaction mock implementation is unavailable');
		}
		backgroundMock.runTransaction
			.mockImplementationOnce(transactionImplementation)
			.mockRejectedValueOnce(new Error('registration write failed'));
		backgroundMock
			.getDocRef('tmp_registrationemails/user-1')
			.set.mockResolvedValue(undefined);

		await expect(
			sendNewRegistrationEmails({
				id: 'user-1',
				data: () => ({
					code: 'ABCD2345',
					qrCodeStoragePath: 'registrations/user-1/test-asset.png',
					name: 'Buddy',
					email: 'buddy.elf@example.com',
					formattedDateTime: 'Wednesday, December 10, 6:00 PM',
					templateKey: 'confirmation',
					deliveryState: 'queued',
				}),
			} as never),
		).rejects.toThrow('registration write failed');

		expect(
			backgroundMock.getDocRef('tmp_registrationemails/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'accepted',
				deliveryProviderMessageId: 'msg-123',
			}),
			{ merge: true },
		);
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/user-1').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'sent',
				deliveryCompletedOn: expect.any(Date),
			}),
			{ merge: true },
		);
		expect(backgroundMock.runTransaction).toHaveBeenCalledTimes(2);

		backgroundMock.setDocSnapshot(
			'tmp_registrationemails/user-1',
			{
				code: 'ABCD2345',
				qrCodeStoragePath: 'registrations/user-1/test-asset.png',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'confirmation',
				deliveryState: 'accepted',
				deliveryProviderAcceptedOn: new Date(
					'2025-12-10T18:00:00.000Z',
				),
				deliveryProviderMessageId: 'msg-123',
			},
			true,
		);
		backgroundMock.setDocSnapshot(
			'registrations/user-1',
			activeRegistration(
				'user-1',
				'ABCD2345',
				'Buddy',
				'buddy.elf@example.com',
			),
		);
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
				templateKey: 'confirmation',
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

	it('does not resend when the same Firestore event retries an already-claimed send', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-4', {
			code: 'LOCK1234',
			qrCodeStoragePath: 'registrations/user-4/test-asset.png',
			name: 'Tinsel',
			email: 'tinsel.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
			deliveryState: 'sending',
			deliveryAttemptEventId: 'evt-claimed',
			deliveryAttemptedOn: new Date('2025-12-10T18:00:00.000Z'),
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-4',
			activeRegistration(
				'user-4',
				'LOCK1234',
				'Tinsel',
				'tinsel.elf@example.com',
			),
		);
		backgroundMock
			.getDocRef('tmp_registrationemails/user-4')
			.set.mockResolvedValue(undefined);

		await sendNewRegistrationEmails(
			{
				id: 'user-4',
				data: () => ({
					code: 'LOCK1234',
					name: 'Tinsel',
					email: 'tinsel.elf@example.com',
					formattedDateTime: 'Wednesday, December 10, 6:00 PM',
					templateKey: 'confirmation',
					deliveryState: 'sending',
					deliveryAttemptEventId: 'evt-claimed',
				}),
			} as never,
			{ eventId: 'evt-claimed' },
		);

		expect(sesSendMock).not.toHaveBeenCalled();
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/user-4').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryRequiresReviewOn: expect.any(Date),
				deliveryRequiresReviewReason: expect.stringContaining(
					'automatic resend was skipped',
				),
			}),
			{ merge: true },
		);
	});

	it('repairs accepted sends without calling SES again', async () => {
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setDocSnapshot('tmp_registrationemails/user-5', {
			code: 'DONE1234',
			qrCodeStoragePath: 'registrations/user-5/test-asset.png',
			name: 'Sparkle',
			email: 'sparkle.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'confirmation',
			deliveryState: 'accepted',
			deliveryProviderAcceptedOn: new Date('2025-12-10T18:15:00.000Z'),
			deliveryProviderMessageId: 'msg-accepted',
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-5',
			activeRegistration(
				'user-5',
				'DONE1234',
				'Sparkle',
				'sparkle.elf@example.com',
			),
		);
		backgroundMock
			.getDocRef('tmp_registrationemails/user-5')
			.set.mockResolvedValue(undefined);
		backgroundMock
			.getDocRef('registrations/user-5')
			.set.mockResolvedValue(undefined);

		await sendNewRegistrationEmails({
			id: 'user-5',
			data: () => ({
				code: 'DONE1234',
				name: 'Sparkle',
				email: 'sparkle.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'confirmation',
				deliveryState: 'accepted',
				deliveryProviderAcceptedOn: new Date(
					'2025-12-10T18:15:00.000Z',
				),
				deliveryProviderMessageId: 'msg-accepted',
			}),
		} as never);

		expect(sesSendMock).not.toHaveBeenCalled();
		expect(
			backgroundMock.getDocRef('tmp_registrationemails/user-5').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'sent',
				deliveryProviderMessageId: 'msg-accepted',
			}),
			{ merge: true },
		);
		expect(
			backgroundMock.getDocRef('registrations/user-5').set,
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
			qrCodeStoragePath: 'registrations/user-3/test-asset.png',
			name: 'Noelle',
			email: 'noelle.elf@example.com',
			formattedDateTime: 'Wednesday, December 10, 6:00 PM',
			templateKey: 'event-reminder',
		});
		backgroundMock.setDocSnapshot(
			'registrations/user-3',
			activeRegistration(
				'user-3',
				'REM12345',
				'Noelle',
				'noelle.elf@example.com',
			),
		);
		backgroundMock.setDocSnapshot(
			'emailTemplates/special-reminder-2026/revisions/rev-3',
			{
				deliveryProfile: 'event-reminder',
				fieldMappings: [
					{
						name: 'guestName',
						mapping: 'firstName',
						sampleValue: 'Noelle',
					},
				],
			},
		);
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
		backgroundMock
			.getDocRef('registrations/user-3')
			.set.mockResolvedValue(undefined);
		backgroundMock
			.getDocRef('tmp_registrationemails/user-3')
			.set.mockResolvedValue(undefined);

		await sendNewRegistrationEmails({
			id: 'user-3',
			data: () => ({
				code: 'REM12345',
				qrCodeStoragePath: 'registrations/user-3/test-asset.png',
				name: 'Noelle',
				email: 'noelle.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'event-reminder',
			}),
		} as never);

		expect(
			(
				sesSendMock.mock.calls[0]?.[0] as {
					input: { Template: string };
				}
			).input.Template,
		).toBe('custom-event-reminder-v2');
		expect(
			JSON.parse(
				(
					sesSendMock.mock.calls[0]?.[0] as {
						input: { TemplateData: string };
					}
				).input.TemplateData,
			),
		).toEqual(
			expect.objectContaining({
				guestName: 'Noelle',
				firstName: 'Noelle',
			}),
		);
	});
});
