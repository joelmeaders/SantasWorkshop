import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	loadTriggerScheduledHandlers,
	sesSendMock,
} from '../helpers/trigger-scheduled.unit-helper';

describe('bilingual email delivery', () => {
	let db: ReturnType<typeof createBackgroundAdminMock>;
	beforeEach(() => {
		db = createBackgroundAdminMock();
	});

	const prepare = (
		profile: string,
		language: string,
		available: string[] = [language],
	): void => {
		const now = new Date('2026-11-01T12:00:00Z');
		db.setDocSnapshot('users/family', { preferredLanguage: language });
		db.setDocSnapshot('registrations/family', {
			uid: 'family',
			firstName: 'María',
			emailAddress: 'family@example.com',
			qrcode: 'TICKET26',
			qrCodeStoragePath: 'registrations/family/ticket.png',
			registrationSubmittedOn: now,
			reminderEmailQueuedOn: now,
			dateTimeSlot: { id: 'appointment' },
			...(profile === 'registration-cancellation'
				? { cancelledOn: now, cancellationLogId: 'cancel-1' }
				: {}),
		});
		db.setDocSnapshot('tmp_registrationemails/message', {
			registrationUid: 'family',
			name: 'María',
			email: 'family@example.com',
			code: 'TICKET26',
			qrCodeStoragePath: 'registrations/family/ticket.png',
			templateKey: profile,
			deliveryRequestedOn: now,
			formattedDateTime: 'Legacy appointment text',
			appointmentDateTime: new Date('2026-12-12T18:00:00Z'),
			queueSource: profile,
			cancellationLogId: 'cancel-1',
		});
		db.setCollectionDocs(
			'emailTemplates',
			available.map((locale) => ({
				id: profile + '-' + locale,
				data: {
					key: profile + '-' + locale,
					deliveryProfile: profile,
					language: locale,
					awsTemplateName: profile + '-' + locale,
					publishedRevisionId: 'published',
					publishedOn: now,
					fieldMappings: [{ name: 'guest', mapping: 'code' }], // An unpublished edit must not leak into delivery.
				},
			})),
		);
		for (const locale of available)
			db.setDocSnapshot(
				`emailTemplates/${profile}-${locale}/revisions/published`,
				{
					language: locale,
					deliveryProfile: profile,
					fieldMappings: [{ name: 'guest', mapping: 'firstName' }],
				},
			);
	};

	it.each(
		[
			'registration-confirmation',
			'event-reminder',
			'registration-cancellation',
		].flatMap((profile) =>
			['en', 'es'].map((language) => [profile, language]),
		),
	)('sends %s in profile language %s', async (profile, language) => {
		prepare(profile, language);
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(db);
		sesSendMock.mockResolvedValue({ MessageId: 'accepted' });
		await sendNewRegistrationEmails({
			id: 'message',
			data: (): object => ({}),
		} as never);
		expect(sesSendMock).toHaveBeenCalledOnce();
		const command = sesSendMock.mock.calls[0][0].input;
		expect(command.Template).toBe(profile + '-' + language);
		const data = JSON.parse(command.TemplateData);
		expect(data.guest).toBe('María');
		expect(data.dateTime).toContain(
			language === 'es' ? 'diciembre' : 'December',
		);
		expect(data.dateTime).toContain('11:00');
		if (profile === 'registration-cancellation') {
			expect(data).not.toHaveProperty('code');
			expect(data).not.toHaveProperty('qrCodeUrl');
		}
		expect(
			db.getDocRef('tmp_registrationemails/message').update,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				requestedLanguage: language,
				deliveredLanguage: language,
				selectedRevisionId: 'published',
				languageFallbackReason: false,
			}),
		);
	});

	it('defaults old profiles to English and preserves older queued appointment text', async () => {
		prepare('registration-confirmation', 'en');
		db.setDocSnapshot('users/family', {});
		db.setDocSnapshot('tmp_registrationemails/message', {
			registrationUid: 'family',
			name: 'María',
			email: 'family@example.com',
			code: 'TICKET26',
			qrCodeStoragePath: 'registrations/family/ticket.png',
			templateKey: 'registration-confirmation',
			formattedDateTime: 'Legacy appointment text',
			deliveryRequestedOn: new Date('2026-11-01T12:00:00Z'),
		});
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(db);
		sesSendMock.mockResolvedValue({ MessageId: 'accepted' });
		await sendNewRegistrationEmails({
			id: 'message',
			data: (): object => ({}),
		} as never);
		expect(sesSendMock.mock.calls[0][0].input.Template).toBe(
			'registration-confirmation-en',
		);
		expect(
			JSON.parse(sesSendMock.mock.calls[0][0].input.TemplateData)
				.dateTime,
		).toBe('Legacy appointment text');
	});

	it('falls back to English and uses English dates when Spanish is unpublished', async () => {
		prepare('event-reminder', 'es', ['en']);
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(db);
		sesSendMock.mockResolvedValue({ MessageId: 'accepted' });
		await sendNewRegistrationEmails({
			id: 'message',
			data: (): object => ({}),
		} as never);
		expect(sesSendMock.mock.calls[0][0].input.Template).toBe(
			'event-reminder-en',
		);
		expect(
			JSON.parse(sesSendMock.mock.calls[0][0].input.TemplateData)
				.dateTime,
		).toContain('December');
		expect(
			db.getDocRef('tmp_registrationemails/message').update,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				requestedLanguage: 'es',
				deliveredLanguage: 'en',
				languageFallbackReason: expect.any(String),
			}),
		);
	});

	it('keeps a Spanish plain-text cancellation fallback without an active ticket', async () => {
		prepare('registration-cancellation', 'es', []);
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(db);
		sesSendMock.mockResolvedValue({ MessageId: 'accepted' });
		await sendNewRegistrationEmails({
			id: 'message',
			data: (): object => ({}),
		} as never);
		const command = sesSendMock.mock.calls[0][0].input;
		expect(command.Message.Subject.Data).toContain('cancelada');
		expect(command.Message.Body.Text.Data).toContain('diciembre');
		expect(command.Message.Body.Text.Data).not.toContain('TICKET26');
	});

	it('records a missing template as failed without sending', async () => {
		prepare('event-reminder', 'es', []);
		const { sendNewRegistrationEmails } =
			await loadTriggerScheduledHandlers(db);
		await expect(
			sendNewRegistrationEmails({
				id: 'message',
				data: (): object => ({}),
			} as never),
		).rejects.toThrow('published SES template');
		expect(sesSendMock).not.toHaveBeenCalled();
		expect(
			db.getDocRef('tmp_registrationemails/message').update,
		).toHaveBeenCalledWith(
			expect.objectContaining({ deliveryState: 'failed' }),
		);
	});
});

describe('preferred language callable', () => {
	it('updates only the authenticated customer profile', async () => {
		const db = createBackgroundAdminMock();
		db.setDocSnapshot('users/test-user-123', { firstName: 'María' });
		vi.resetModules();
		vi.doMock('firebase-admin', () => db.module);
		const update = (await import('../../../src/fn/updatePreferredLanguage'))
			.default;
		await update(
			createCallableRequest({
				preferredLanguage: 'es',
				uid: 'someone-else',
			} as never),
		);
		expect(db.getDocRef('users/test-user-123').set).toHaveBeenCalledWith(
			{ preferredLanguage: 'es' },
			{ merge: true },
		);
		expect(db.getDocRef('users/someone-else').set).not.toHaveBeenCalled();
		await expect(
			update(createCallableRequest({ preferredLanguage: 'fr' } as never)),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		await expect(
			update({ data: { preferredLanguage: 'en' } } as never),
		).rejects.toMatchObject({ code: 'unauthenticated' });
	});
});
