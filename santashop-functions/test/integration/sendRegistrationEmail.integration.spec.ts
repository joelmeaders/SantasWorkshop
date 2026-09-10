vi.mock('../../src/utility/email-sending', () => ({
	isEmailSendingEnabled: vi.fn().mockResolvedValue(true),
}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentSnapshot, Timestamp } from 'firebase-admin/firestore';

const sesSend = vi.fn();

vi.mock('@aws-sdk/client-ses', () => ({
	SESClient: class {
		public send = sesSend;
	},
	SendTemplatedEmailCommand: class {
		constructor(public readonly input: unknown) {}
	},
}));

import sendNewRegistrationEmails from '../../src/fn/sendRegistrationEmail';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	getFirestore,
	seedQrCode,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('sendRegistrationEmail integration', () => {
	beforeEach(async () => {
		sesSend.mockReset();
		sesSend.mockResolvedValue({
			MessageId: 'ses-message-1',
			$metadata: { httpStatusCode: 200 },
		});
		await clearEmulatorData();
		await getFirestore()
			.doc('emailTemplates/confirmation/revisions/revision-1')
			.set({ fieldMappings: [] });
		await setDocument(COLLECTION_SCHEMA.emailTemplates, 'confirmation', {
			key: 'confirmation',
			awsTemplateName: 'confirmation-published',
			publishedRevisionId: 'revision-1',
			fieldMappings: [],
		});
	});

	const seedDeletionRace = async (uid: string): Promise<DocumentSnapshot> => {
		const qrCodeStoragePath = `registrations/${uid}/code.png`;
		const queuedOn = createTimestamp('2025-12-01T01:00:00.000Z');
		await seedQrCode(qrCodeStoragePath);
		await setDocument(COLLECTION_SCHEMA.registrations, uid, {
			uid,
			qrcode: 'DELETE12',
			qrCodeStoragePath,
			firstName: 'Buddy',
			emailAddress: 'buddy.elf@example.com',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
			reminderEmailQueuedOn: queuedOn,
			reminderEmailSentOn: false,
		});
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			`request-${uid}`,
			{
				registrationUid: uid,
				code: 'DELETE12',
				qrCodeStoragePath,
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				appointmentSlotId: 'slot-1',
				templateKey: 'confirmation',
				deliveryRequestedOn: queuedOn,
				deliveryState: 'queued',
			},
		);
		return getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.doc(`request-${uid}`)
			.get();
	};

	it('does not recreate a deleted queue from a delayed creation snapshot', async () => {
		const uid = 'deleted-before-trigger';
		const snapshot = await seedDeletionRace(uid);
		const registrationRef = getFirestore()
			.collection(COLLECTION_SCHEMA.registrations)
			.doc(uid);
		await snapshot.ref.delete();
		await registrationRef.delete();

		await sendNewRegistrationEmails(snapshot as never);

		expect((await snapshot.ref.get()).exists).toBe(false);
		expect((await registrationRef.get()).exists).toBe(false);
		expect(sesSend).not.toHaveBeenCalled();
	});

	it('keeps an accepted send recorded without recreating its deleted queue or resending on replay', async () => {
		const uid = 'deleted-after-acceptance';
		const snapshot = await seedDeletionRace(uid);
		sesSend.mockImplementationOnce(async () => {
			await snapshot.ref.delete();
			return {
				MessageId: 'accepted-deleted-queue',
				$metadata: { httpStatusCode: 200 },
			};
		});

		await sendNewRegistrationEmails(snapshot as never, {
			eventId: 'deleted-queue-event',
		});

		expect((await snapshot.ref.get()).exists).toBe(false);
		const registration = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrations,
			uid,
		);
		expect(registration?.['reminderEmailFailedOn']).toBe(false);
		const sentOn = registration?.['reminderEmailSentOn'] as Timestamp;
		expect(sentOn.toMillis()).toBeGreaterThan(0);

		await sendNewRegistrationEmails(snapshot as never, {
			eventId: 'deleted-queue-event',
		});

		expect(sesSend).toHaveBeenCalledOnce();
		expect((await snapshot.ref.get()).exists).toBe(false);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				uid,
			),
		).toMatchObject({
			reminderEmailSentOn: sentOn,
			reminderEmailFailedOn: false,
		});
	});

	it('sends and marks queued registration emails as sent', async () => {
		const qrCodeStoragePath = 'registrations/queued-user-1/code.png';
		await seedQrCode(qrCodeStoragePath);
		await setDocument(COLLECTION_SCHEMA.registrations, 'queued-user-1', {
			uid: 'queued-user-1',
			qrcode: 'ABCD2345',
			qrCodeStoragePath,
			firstName: 'Buddy',
			emailAddress: 'buddy.elf@example.com',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
		});
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'queued-user-1',
			{
				code: 'ABCD2345',
				qrCodeStoragePath,
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'confirmation',
			},
		);
		const snapshot = await getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.doc('queued-user-1')
			.get();

		await sendNewRegistrationEmails(snapshot as never);

		const queueDocument = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'queued-user-1',
		);
		expect(queueDocument).toMatchObject({
			deliveryState: 'sent',
			deliveryAttemptCount: 1,
			deliveryProviderMessageId: 'ses-message-1',
			deliveryProviderAcceptedOn: expect.anything(),
			deliveryCompletedOn: expect.anything(),
			failedOn: false,
		});
		expect(sesSend).toHaveBeenCalledOnce();
		expect(sesSend.mock.calls[0][0].input).toMatchObject({
			Destination: { ToAddresses: ['buddy.elf@example.com'] },
			Source: 'noreply@denversantaclausshop.org',
			ReturnPath: 'admin@denversantaclausshop.org',
			Template: 'confirmation-published',
		});
		expect(
			JSON.parse(sesSend.mock.calls[0][0].input.TemplateData),
		).toMatchObject({ firstName: 'Buddy', code: 'ABCD2345' });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'queued-user-1',
			),
		).toMatchObject({ reminderEmailSentOn: expect.anything() });
	});

	it('does not let an accepted older send overwrite a newer delivery request', async () => {
		const uid = 'queued-user-race';
		const qrCodeStoragePath = `registrations/${uid}/code.png`;
		const queuedOn = createTimestamp('2025-12-01T01:00:00.000Z');
		const newerQueuedOn = createTimestamp('2025-12-01T02:00:00.000Z');
		await seedQrCode(qrCodeStoragePath);
		await setDocument(COLLECTION_SCHEMA.registrations, uid, {
			uid,
			qrcode: 'RACE1234',
			qrCodeStoragePath,
			firstName: 'Buddy',
			emailAddress: 'old@example.com',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
			reminderEmailQueuedOn: queuedOn,
			reminderEmailSentOn: false,
		});
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'request-race',
			{
				registrationUid: uid,
				code: 'RACE1234',
				qrCodeStoragePath,
				name: 'Buddy',
				email: 'old@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				appointmentSlotId: 'slot-1',
				templateKey: 'confirmation',
				deliveryRequestedOn: queuedOn,
				deliveryState: 'queued',
			},
		);
		sesSend.mockImplementationOnce(async () => {
			await getFirestore()
				.collection(COLLECTION_SCHEMA.registrations)
				.doc(uid)
				.set(
					{
						emailAddress: 'new@example.com',
						reminderEmailQueuedOn: newerQueuedOn,
						reminderEmailSentOn: false,
					},
					{ merge: true },
				);
			return {
				MessageId: 'accepted-race',
				$metadata: { httpStatusCode: 200 },
			};
		});
		const snapshot = await getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.doc('request-race')
			.get();

		await sendNewRegistrationEmails(snapshot as never);

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				'request-race',
			),
		).toMatchObject({ deliveryState: 'sent' });
		const registration = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrations,
			uid,
		);
		expect(registration).toMatchObject({
			emailAddress: 'new@example.com',
			reminderEmailSentOn: false,
		});
		expect(
			(
				registration?.['reminderEmailQueuedOn'] as {
					toMillis: () => number;
				}
			).toMillis(),
		).toBe(newerQueuedOn.toMillis());
	});
});
