import { beforeEach, describe, expect, it, vi } from 'vitest';

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
		sesSend.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		await clearEmulatorData();
		await setDocument(COLLECTION_SCHEMA.emailTemplates, 'confirmation', {
			key: 'confirmation',
			awsTemplateName: 'confirmation-published',
			publishedRevisionId: 'revision-1',
			fieldMappings: [],
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
		expect(queueDocument).toBeDefined();
		expect(queueDocument?.['deliveryState']).toMatch(/sending|sent/);
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
