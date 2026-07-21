import { beforeEach, describe, expect, it } from 'vitest';
import { createRegistration } from '../../fixtures/factories';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('completeRegistration handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
	});

	it('writes the registration, email, and search index records', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		const registration = createRegistration({ uid: 'user-3' });

		const result = await completeRegistration(
			createCallableRequest(registration, { uid: 'user-3' }),
		);

		expect(result).toBe(true);
		expect(adminMock.batchSet).toHaveBeenCalledTimes(3);
		expect(adminMock.doc).toHaveBeenCalledWith('registrations/user-3');
		expect(adminMock.doc).toHaveBeenCalledWith(
			'tmp_registrationemails/user-3',
		);
		expect(adminMock.doc).toHaveBeenCalledWith(
			'registrationsearchindex/user-3',
		);
	});

	it('rejects incomplete registrations', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		const registration = createRegistration({ children: [] });

		await expect(
			completeRegistration(createCallableRequest(registration)),
		).rejects.toMatchObject({ code: 'failed-precondition' });
	});
});
