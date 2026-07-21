import { beforeEach, describe, expect, it } from 'vitest';
import changeRegistrationDateTime from '../../src/fn/changeRegistrationDateTime';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('changeRegistrationDateTime integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('changes a completed registration to a new time slot', async () => {
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-slot-1', {
			uid: 'user-slot-1',
			qrcode: 'ABCD2345',
			reminderEmailSentOn: createTimestamp('2025-12-03T00:00:00.000Z'),
			emailAddress: 'buddy.elf@example.com',
			firstName: 'Buddy',
			lastName: 'Elf',
			zipCode: '80205',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			hasCheckedIn: false,
			includedInCounts: true,
			dateTimeSlot: {
				id: 'slot-old',
				dateTime: createTimestamp('2025-12-10T18:00:00.000Z'),
			},
		});

		const result = await changeRegistrationDateTime(
			createCallableRequest(
				{
					newDateTimeSlot: {
						id: 'slot-new',
						dateTime: '2025-12-11T18:00:00.000Z',
					},
				},
				{ uid: 'user-slot-1' },
			),
		);

		expect(result).toBe(true);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'user-slot-1',
			),
		).toMatchObject({
			includedInCounts: false,
			reminderEmailSentOn: false,
			reminderEmailFailedOn: false,
			previousDateTimeSlot: {
				id: 'slot-old',
			},
			dateTimeSlot: {
				id: 'slot-new',
			},
		});
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				'user-slot-1',
			),
		).toMatchObject({ code: 'ABCD2345', email: 'buddy.elf@example.com' });
	});
});
