import { beforeEach, describe, expect, it } from 'vitest';
import { createRegistration } from '../../fixtures/factories';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createCheckInAdminMock,
	type CheckInAdminMock,
	generateIdMock,
	generateQrCodeMock,
	loadCheckInAdminHandlers,
} from '../helpers/checkin-admin.unit-helper';

describe('callableResendRegistrationEmail handler', () => {
	let adminMock: CheckInAdminMock;

	beforeEach(() => {
		adminMock = createCheckInAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		generateQrCodeMock.mockResolvedValue(undefined);
		generateIdMock.mockReturnValue('ZXCV2345');
	});

	it('writes a resend email record for the owner', async () => {
		const { callableResendRegistrationEmail } =
			await loadCheckInAdminHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/test-user-123', {
			uid: 'test-user-123',
			qrcode: 'ABCD2345',
			qrCodeStoragePath: 'registrations/test-user-123/test-asset.png',
			reminderEmailSentOn: new Date('2025-12-05T00:00:00.000Z'),
			qrCodeGeneratedOn: new Date('2025-12-01T00:00:00.000Z'),
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'buddy.elf@example.com',
			zipCode: '80205',
			children: [{ firstName: 'Noelle', lastName: 'Elf', enabled: true }],
			dateTimeSlot: {
				id: 'slot-1',
				dateTime: {
					toDate: () => new Date('2025-12-10T18:00:00.000Z'),
				},
			},
		});
		adminMock
			.getDocRef('registrations/test-user-123')
			.set.mockResolvedValue(undefined);

		const result = await callableResendRegistrationEmail(
			createCallableRequest(
				{ customerId: 'test-user-123' },
				{ uid: 'test-user-123' },
			),
		);

		expect(result).toBe(true);
		expect(
			adminMock.getDocRef('tmp_registrationemails/test-user-123').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				code: 'ABCD2345',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Thursday, December 11, 6:00 PM',
			}),
			{ merge: true },
		);
		expect(
			adminMock.getDocRef('registrations/test-user-123').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				reminderEmailQueuedOn: expect.any(Date),
				reminderEmailFailedOn: false,
				reminderEmailSentOn: false,
			}),
			{ merge: true },
		);
	});

	it('rejects a missing registration and an unrelated non-staff caller', async () => {
		const { callableResendRegistrationEmail } =
			await loadCheckInAdminHandlers(adminMock);
		await expect(
			callableResendRegistrationEmail(
				createCallableRequest({ customerId: 'missing' }, { uid: 'owner' }),
			),
		).rejects.toMatchObject({ code: 'not-found' });

		adminMock.setDocSnapshot('registrations/customer', {
			...createRegistration({ uid: 'customer' }),
			qrCodeGeneratedOn: new Date(),
			dateTimeSlot: { id: 'slot-1', dateTime: new Date() },
		});
		await expect(
			callableResendRegistrationEmail(
				createCallableRequest({ customerId: 'customer' }, { uid: 'intruder' }),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('requires a complete registration, a generated QR image, and an appointment', async () => {
		const { callableResendRegistrationEmail } =
			await loadCheckInAdminHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/customer', {
			...createRegistration({ uid: 'customer', children: [] }),
		});
		await expect(
			callableResendRegistrationEmail(
				createCallableRequest({ customerId: 'customer' }, { uid: 'customer' }),
			),
		).rejects.toMatchObject({ code: 'failed-precondition', message: '-10' });

		adminMock.setDocSnapshot('registrations/customer', {
			...createRegistration({ uid: 'customer' }),
			qrCodeStoragePath: '',
		});
		await expect(
			callableResendRegistrationEmail(
				createCallableRequest({ customerId: 'customer' }, { uid: 'customer' }),
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });

		adminMock.setDocSnapshot('registrations/customer', {
			...createRegistration({ uid: 'customer' }),
			qrCodeGeneratedOn: new Date(),
			dateTimeSlot: { id: 'slot-1' },
		});
		await expect(
			callableResendRegistrationEmail(
				createCallableRequest({ customerId: 'customer' }, { uid: 'customer' }),
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
	});
});
