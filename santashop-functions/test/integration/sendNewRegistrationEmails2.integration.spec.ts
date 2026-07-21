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

import sendNewRegistrationEmails from '../../src/fn/sendNewRegistrationEmails2';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getDocument,
	getFirestore,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('sendNewRegistrationEmails2 integration', () => {
	beforeEach(async () => {
		sesSend.mockReset();
		sesSend.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
		await clearEmulatorData();
	});

	it('sends and marks queued registration emails as sent', async () => {
		await setDocument(COLLECTION_SCHEMA.registrations, 'queued-user-1', {
			uid: 'queued-user-1',
			emailAddress: 'buddy.elf@example.com',
		});
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'queued-user-1',
			{
				code: 'ABCD2345',
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
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
});
