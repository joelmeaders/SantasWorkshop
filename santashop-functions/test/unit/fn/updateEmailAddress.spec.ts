import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('updateEmailAddress handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		adminMock.updateUser.mockResolvedValue(undefined);
	});

	it('updates auth and all related documents', async () => {
		const { updateEmailAddress } =
			await loadAccountRegistrationHandlers(adminMock);

		const result = await updateEmailAddress(
			createCallableRequest(
				{ emailAddress: 'new.email@example.com' },
				{
					uid: 'user-6',
					email: 'old.email@example.com',
				},
			),
		);

		expect(result).toBe(true);
		expect(adminMock.updateUser).toHaveBeenCalledWith('user-6', {
			email: 'new.email@example.com',
		});
		expect(adminMock.batchSet).toHaveBeenCalledTimes(3);
	});

	it('throws an HttpsError when the user is missing from context', async () => {
		const { updateEmailAddress } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			updateEmailAddress(
				{ emailAddress: 'new.email@example.com' },
				{} as never,
			),
		).rejects.toMatchObject({ code: 'not-found' });
	});
});
