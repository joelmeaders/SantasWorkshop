import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('changeAccountInformation handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		adminMock.updateUser.mockResolvedValue(undefined);
	});

	it('updates auth and related documents for the authenticated user', async () => {
		const { changeAccountInformation } =
			await loadAccountRegistrationHandlers(adminMock);

		const result = await changeAccountInformation(
			createCallableRequest(
				{
					firstName: 'Jovie',
					lastName: 'Elf',
					zipCode: 80211,
				},
				{ uid: 'user-1' },
			),
		);

		expect(result).toBe(true);
		expect(adminMock.updateUser).toHaveBeenCalledWith('user-1', {
			displayName: 'Jovie Elf',
		});
		expect(adminMock.batchSet).toHaveBeenCalledTimes(3);
		expect(adminMock.doc).toHaveBeenCalledWith('users/user-1');
		expect(adminMock.doc).toHaveBeenCalledWith(
			'registrationsearchindex/user-1',
		);
		expect(adminMock.doc).toHaveBeenCalledWith('registrations/user-1');
	});

	it('throws when required data is missing', async () => {
		const { changeAccountInformation } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			changeAccountInformation(
				createCallableRequest(
					{
						firstName: '',
						lastName: 'Elf',
						zipCode: 80211,
					},
					{},
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('throws unauthenticated when the user is missing from context', async () => {
		const { changeAccountInformation } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			changeAccountInformation(
				createCallableRequest(
					{
						firstName: 'Jovie',
						lastName: 'Elf',
						zipCode: 80211,
					},
					{ uid: '' },
				),
			),
		).rejects.toMatchObject({ code: 'unauthenticated' });
	});

	it('maps Auth profile failures to a callable error before writing Firestore', async () => {
		const { changeAccountInformation } =
			await loadAccountRegistrationHandlers(adminMock);
		adminMock.updateUser.mockRejectedValue({
			code: 'auth/email-already-exists',
			message: 'Email is already in use.',
		});

		await expect(
			changeAccountInformation(
				createCallableRequest(
					{ firstName: 'Jovie', lastName: 'Elf', zipCode: 80211 },
					{ uid: 'user-1' },
				),
			),
		).rejects.toMatchObject({ code: 'already-exists' });
		expect(adminMock.batchSet).not.toHaveBeenCalled();
	});

	it('reports a commit failure after staging the synchronized documents', async () => {
		const { changeAccountInformation } =
			await loadAccountRegistrationHandlers(adminMock);
		adminMock.updateUser.mockResolvedValue(undefined);
		adminMock.batchCommit.mockRejectedValue(new Error('Firestore unavailable'));

		await expect(
			changeAccountInformation(
				createCallableRequest(
					{ firstName: 'Jovie', lastName: 'Elf', zipCode: 80211 },
					{ uid: 'user-1' },
				),
			),
		).rejects.toMatchObject({ code: 'internal', message: 'Error updating user document' });
		expect(adminMock.batchSet).toHaveBeenCalledTimes(3);
	});
});
