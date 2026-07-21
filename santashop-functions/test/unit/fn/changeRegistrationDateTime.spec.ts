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
		adminMock.batchCommit.mockResolvedValue(undefined);
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

		const result = await changeRegistrationDateTime(
			createCallableRequest(
				{
					newDateTimeSlot: {
						id: 'slot-new',
						dateTime: '2025-12-11T18:00:00.000Z',
					},
				},
				{ uid: 'user-5' },
			),
		);

		expect(result).toBe(true);
		expect(adminMock.batchSet).toHaveBeenCalledTimes(2);
		expect(adminMock.batchSet).toHaveBeenNthCalledWith(
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
					dateTime: expect.any(Date),
				}),
			}),
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
						newDateTimeSlot: {
							id: 'slot-new',
							dateTime: '2025-12-11T18:00:00.000Z',
						},
					},
					{ uid: 'user-5', admin: false },
				),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});
});
