import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('updateReferredBy handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		adminMock.updateUser.mockResolvedValue(undefined);
	});

	it('updates the authenticated user document', async () => {
		const { updateReferredBy } =
			await loadAccountRegistrationHandlers(adminMock);
		const userDoc = adminMock.getDocRef('users/user-2');
		userDoc.update.mockResolvedValue(undefined);

		const result = await updateReferredBy(
			createCallableRequest({ referredBy: 'Friend' }, { uid: 'user-2' }),
		);

		expect(result).toBe(true);
		expect(userDoc.update).toHaveBeenCalledWith({ referredBy: 'Friend' });
	});

	it('throws when referredBy is missing', async () => {
		const { updateReferredBy } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			updateReferredBy(createCallableRequest({ referredBy: '' })),
		).rejects.toMatchObject({ code: 'data-loss' });
	});
});
