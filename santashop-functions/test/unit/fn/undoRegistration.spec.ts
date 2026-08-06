import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('undoRegistration handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
	});

	it('records an authorized cancellation and resets registration state', async () => {
		const { undoRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/user-4', {
			uid: 'user-4',
			qrcode: 'ABCD2345',
			dateTimeSlot: {
				id: 'slot-1',
				dateTime: '2025-12-10T18:00:00.000Z',
			},
			registrationSubmittedOn: new Date('2025-12-01T00:00:00.000Z'),
			includedInCounts: true,
		});
		adminMock.setDocSnapshot('parameters/public', {
			admin: { allowCancelRegistration: true },
		});
		adminMock.setDocSnapshot(
			'registrations/user-4/mutationReceipts/cancel-user-0001',
			{},
			false,
		);

		const result = await undoRegistration(
			createCallableRequest(
				{ mutationId: 'cancel-user-0001' },
				{ uid: 'user-4' },
			),
		);

		expect(result).toBe(true);
		expect(adminMock.transactionDelete).toHaveBeenCalledTimes(2);
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(1);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
		expect.objectContaining({ path: 'registrations/user-4' }),
			expect.objectContaining({
				includedInCounts: false,
				previousDateTimeSlot: {
					id: 'slot-1',
					dateTime: '2025-12-10T18:00:00.000Z',
				},
			}),
		);
	});

	it('treats an already-cancelled registration as a retry-safe success', async () => {
		const { undoRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/user-4', {
			uid: 'user-4',
			qrcode: 'NEWCODE1',
			firstName: 'Customer',
			emailAddress: 'customer@example.com',
			previousDateTimeSlot: { id: 'slot-1', dateTime: '2025-12-10T18:00:00.000Z' },
			cancelledOn: new Date('2025-12-01T00:00:00.000Z'),
		});
		adminMock.setDocSnapshot('parameters/public', {
			admin: { allowCancelRegistration: true },
		});
		adminMock.setDocSnapshot(
			'registrations/user-4/mutationReceipts/cancel-user-0001',
			{ operation: 'undoRegistration', result: true },
		);

		await expect(
			undoRegistration(
				createCallableRequest(
					{ mutationId: 'cancel-user-0001' },
					{ uid: 'user-4' },
				),
			),
		).resolves.toBe(true);
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});
});
