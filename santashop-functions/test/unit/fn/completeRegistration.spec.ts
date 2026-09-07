import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';
import { PROGRAM_YEAR } from '../../../src/utility/runtime-config';

describe('completeRegistration handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
	});

	const seedCompletableRegistration = (
		dateOfBirth = new Date('2020-12-15T00:00:00.000Z'),
	): void => {
		adminMock.setDocSnapshot('registrations/user-3', {
			uid: 'user-3',
			qrcode: 'ABCD2345',
			qrCodeStoragePath: 'registrations/user-3/test-asset.png',
			children: [
				{
					id: 1,
					firstName: 'Noelle',
					lastName: 'Elf',
					dateOfBirth,
					toyType: 'girls',
				},
			],
			dateTimeSlot: { id: 'slot-1' },
		});
		adminMock.setDocSnapshot('users/user-3', {
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'buddy.elf@example.com',
			zipCode: '80205',
		});
		adminMock.setDocSnapshot('_testConfig/publicParameters', {
			registrationEnabled: true,
			admin: { preRegistrationEnabled: true },
		});
		adminMock.setDocSnapshot('dateTimeSlots/slot-1', {
			id: 'slot-1',
			programYear: 2025,
			enabled: true,
			maxSlots: 10,
			dateTime: new Date('2025-12-10T18:00:00.000Z'),
		});
		adminMock.setDocSnapshot(
			'registrations/user-3/mutationReceipts/submit-0001',
			{},
			false,
		);
	};

	it('loads canonical data and writes registration side effects without updating the slot', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		seedCompletableRegistration();

		const result = await completeRegistration(
			createCallableRequest(
				{ mutationId: 'submit-0001' },
				{ uid: 'user-3' },
			),
		);

		expect(result).toBe(true);
		expect(adminMock.transactionSet).toHaveBeenCalledTimes(2);
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(2);
		expect(adminMock.doc).toHaveBeenCalledWith('registrations/user-3');
		expect(adminMock.doc).toHaveBeenCalledWith('users/user-3');
		expect(adminMock.doc).toHaveBeenCalledWith('dateTimeSlots/slot-1');
		expect(adminMock.transactionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'tmp_registrationemails/generated-id',
			}),
			expect.objectContaining({
				registrationUid: 'user-3',
				appointmentSlotId: 'slot-1',
				queueSource: 'registration-completion',
			}),
		);
		expect(adminMock.doc).toHaveBeenCalledWith(
			'registrationsearchindex/user-3',
		);
	});

	it('rejects an age 12 child before writing completion side effects', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		seedCompletableRegistration(new Date(PROGRAM_YEAR - 12, 11, 31));

		await expect(
			completeRegistration(
				createCallableRequest(
					{ mutationId: 'submit-0001' },
					{ uid: 'user-3' },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('rejects unsupported client registration fields', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			completeRegistration(
				createCallableRequest({
					mutationId: 'submit-0001',
					uid: 'other',
				}),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('returns the stored result for an idempotent retry', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		seedCompletableRegistration();
		adminMock.setDocSnapshot(
			'registrations/user-3/mutationReceipts/submit-0001',
			{ operation: 'completeRegistration', result: true },
		);

		await expect(
			completeRegistration(
				createCallableRequest(
					{ mutationId: 'submit-0001' },
					{ uid: 'user-3' },
				),
			),
		).resolves.toBe(true);
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});
});
