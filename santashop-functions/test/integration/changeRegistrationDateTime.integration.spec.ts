import { beforeEach, describe, expect, it, vi } from 'vitest';
import changeRegistrationDateTime from '../../src/fn/changeRegistrationDateTime';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	getFirestore,
	seedQrCode,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('changeRegistrationDateTime integration', () => {
	beforeEach(async () => {
		vi.spyOn(Date, 'now').mockReturnValue(
			Date.parse('2025-12-01T00:00:00.000Z'),
		);
		await clearEmulatorData();
	});

	it('changes a completed registration to a new time slot', async () => {
		const qrCodeStoragePath = 'registrations/user-slot-1/code.png';
		await seedQrCode(qrCodeStoragePath);
		await setDocument(COLLECTION_SCHEMA.parameters, 'public', {
			admin: { allowChangeRegistration: true },
		});
		await setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'slot-new', {
			programYear: 2025,
			enabled: true,
			maxSlots: 10,
			dateTime: createTimestamp('2025-12-11T18:00:00.000Z'),
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-slot-1', {
			uid: 'user-slot-1',
			qrcode: 'ABCD2345',
			qrCodeStoragePath,
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
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'prior-confirmation',
			{
				registrationUid: 'user-slot-1',
				queueSource: 'registration-completion',
				deliveryState: 'sent',
			},
		);

		const result = await changeRegistrationDateTime(
			createCallableRequest(
				{
					mutationId: 'change-slot-0001',
					slotId: 'slot-new',
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
		const queuedEmails = await getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.where('registrationUid', '==', 'user-slot-1')
			.get();
		expect(queuedEmails.size).toBe(2);
		expect(
			queuedEmails.docs
				.find(
					(document) =>
						document.data()['queueSource'] === 'date-time-change',
				)
				?.data(),
		).toMatchObject({
			code: 'ABCD2345',
			email: 'buddy.elf@example.com',
			appointmentSlotId: 'slot-new',
		});
	});
});
