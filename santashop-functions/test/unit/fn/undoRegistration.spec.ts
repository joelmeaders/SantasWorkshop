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
		adminMock.batchCommit.mockResolvedValue(undefined);
	});

	it('removes the index entry and resets registration state', async () => {
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

		const result = await undoRegistration(
			createCallableRequest({ uid: 'user-4' }, { uid: 'user-4' }),
		);

		expect(result).toBe(true);
		expect(adminMock.batchDelete).toHaveBeenCalledTimes(1);
		expect(adminMock.batchSet).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'registrations/user-4' }),
			expect.objectContaining({
				uid: 'user-4',
				includedInCounts: false,
				previousDateTimeSlot: {
					id: 'slot-1',
					dateTime: '2025-12-10T18:00:00.000Z',
				},
			}),
		);
	});
});
