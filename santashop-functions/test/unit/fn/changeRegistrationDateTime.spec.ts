import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('changeRegistrationDateTime handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
	});

	it('updates the slot and queues a fresh email record', async () => {
		const { changeRegistrationDateTime } =
			await loadAccountRegistrationHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/user-5', {
			uid: 'user-5',
			qrcode: 'ABCD2345',
			reminderEmailSentOn: new Date('2025-12-02T00:00:00.000Z'),
			emailAddress: 'buddy.elf@example.com',
			firstName: 'Buddy',
			lastName: 'Elf',
			zipCode: '80205',
			registrationSubmittedOn: new Date('2025-12-01T00:00:00.000Z'),
			hasCheckedIn: false,
			dateTimeSlot: {
				id: 'slot-old',
				dateTime: '2025-12-10T18:00:00.000Z',
			},
		});
		adminMock.setDocSnapshot('parameters/public', {
			admin: { allowChangeRegistration: true },
		});
		adminMock.setDocSnapshot('dateTimeSlots/slot-new', {
			id: 'slot-new',
			programYear: 2025,
			enabled: true,
			maxSlots: 10,
			dateTime: new Date('2025-12-11T18:00:00.000Z'),
		});
		adminMock.setDocSnapshot(
			'registrations/user-5/mutationReceipts/change-slot-0001',
			{},
			false,
		);

		const result = await changeRegistrationDateTime(
			createCallableRequest(
				{
					mutationId: 'change-slot-0001',
					slotId: 'slot-new',
				},
				{ uid: 'user-5' },
			),
		);

		expect(result).toBe(true);
		expect(adminMock.transactionSet).toHaveBeenCalledTimes(2);
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(1);
		expect(adminMock.transactionSet).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ path: 'registrations/user-5' }),
				expect.objectContaining({
				includedInCounts: false,
				reminderEmailSentOn: false,
				reminderEmailFailedOn: false,
				previousDateTimeSlot: {
					id: 'slot-old',
					dateTime: '2025-12-10T18:00:00.000Z',
				},
				dateTimeSlot: expect.objectContaining({
					id: 'slot-new',
					dateTime: new Date('2025-12-11T18:00:00.000Z'),
				}),
			}),
			expect.anything(),
		);
	});

	it('rejects non-admin attempts to change another user registration', async () => {
		const { changeRegistrationDateTime } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			changeRegistrationDateTime(
				createCallableRequest(
				{
					registrationUid: 'other-user',
					mutationId: 'change-slot-0001',
					slotId: 'slot-new',
					},
					{ uid: 'user-5', admin: false },
				),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('returns the stored receipt result without creating another email', async () => {
		const { changeRegistrationDateTime } =
			await loadAccountRegistrationHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/user-5', {
			uid: 'user-5',
			registrationSubmittedOn: new Date('2025-12-01T00:00:00.000Z'),
			dateTimeSlot: { id: 'slot-new' },
		});
		adminMock.setDocSnapshot('parameters/public', {
			admin: { allowChangeRegistration: true },
		});
		adminMock.setDocSnapshot('dateTimeSlots/slot-new', {
			programYear: 2025,
			enabled: true,
			maxSlots: 10,
			dateTime: new Date('2025-12-11T18:00:00.000Z'),
		});
		adminMock.setDocSnapshot(
			'registrations/user-5/mutationReceipts/change-slot-0001',
			{ operation: 'changeRegistrationDateTime', result: true },
		);

		await expect(
			changeRegistrationDateTime(
				createCallableRequest(
					{ mutationId: 'change-slot-0001', slotId: 'slot-new' },
					{ uid: 'user-5' },
				),
			),
		).resolves.toBe(true);
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});
});
