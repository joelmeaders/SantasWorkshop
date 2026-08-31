import { beforeEach, describe, expect, it } from 'vitest';
import callableResendRegistrationEmail from '../../src/fn/callableResendRegistrationEmail';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	seedAuthUser,
	seedQrCode,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';

describe.sequential('callableResendRegistrationEmail integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('queues a resend registration email for owners', async () => {
		const qrCodeStoragePath = 'registrations/resend-user-1/code.png';
		await seedQrCode(qrCodeStoragePath);
		await seedAuthUser({
			uid: 'resend-user-1',
			email: 'resend.user@example.com',
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'resend-user-1', {
			uid: 'resend-user-1',
			qrcode: 'ABCD2345',
			qrCodeStoragePath,
			reminderEmailSentOn: createTimestamp('2025-12-05T00:00:00.000Z'),
			qrCodeGeneratedOn: createTimestamp('2025-12-01T00:00:00.000Z'),
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'resend.user@example.com',
			zipCode: '80205',
			children: [
				{
					firstName: 'Noelle',
					lastName: 'Elf',
					dateOfBirth: createTimestamp('2020-12-15T00:00:00.000Z'),
					ageGroup: '3-5',
					toyType: 'girls',
					enabled: true,
				},
			],
			dateTimeSlot: {
				id: 'slot-1',
				dateTime: createTimestamp('2025-12-10T18:00:00.000Z'),
			},
		});

		const result = await callableResendRegistrationEmail(
			createCallableRequest(
				{ customerId: 'resend-user-1' },
				{ uid: 'resend-user-1' },
			),
		);

		expect(result).toBe(true);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				'resend-user-1',
			),
		).toMatchObject({
			code: 'ABCD2345',
			email: 'resend.user@example.com',
			deliveryState: 'queued',
		});
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'resend-user-1',
			),
		).toMatchObject({ reminderEmailSentOn: false });
	});
});
