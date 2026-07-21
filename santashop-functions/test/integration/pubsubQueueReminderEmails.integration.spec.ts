import { beforeEach, describe, expect, it } from 'vitest';
import pubsubQueueReminderEmails from '../../src/fn/pubsubQueueReminderEmails';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('pubsubQueueReminderEmails integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('queues reminder emails and marks registrations as queued', async () => {
		await setDocument(COLLECTION_SCHEMA.registrations, 'reg-1', {
			uid: 'reg-1',
			qrcode: 'ABCD2345',
			qrCodeGeneratedOn: createTimestamp('2025-12-01T00:00:00.000Z'),
			firstName: 'Buddy',
			emailAddress: 'buddy.elf@example.com',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: {
				dateTime: createTimestamp('2025-12-10T18:00:00.000Z'),
			},
		});

		const result = await pubsubQueueReminderEmails();

		expect(result).toEqual({ success: 1, failed: 0 });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				'reg-1',
			),
		).toMatchObject({ template: 'dscs-event-reminder' });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'reg-1',
			),
		).toMatchObject({ reminderEmailQueuedOn: expect.anything() });

		const secondResult = await pubsubQueueReminderEmails();
		expect(secondResult).toEqual({ success: 0, failed: 0 });
	});
});
