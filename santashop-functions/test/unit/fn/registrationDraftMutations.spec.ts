import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('draft registration mutation handlers', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
	});

	const seedDraft = (children: unknown[] = []): void => {
		adminMock.setDocSnapshot('registrations/user-draft', {
			uid: 'user-draft',
			children,
		});
		adminMock.setDocSnapshot('parameters/public', {
			registrationEnabled: true,
			admin: { preRegistrationEnabled: true },
		});
	};

	it('stores a server-canonical child and a replay receipt', async () => {
		const { saveDraftChild } = await loadAccountRegistrationHandlers(adminMock);
		seedDraft();
		adminMock.setDocSnapshot(
			'registrations/user-draft/mutationReceipts/child-save-0001',
			{},
			false,
		);

		await expect(saveDraftChild(createCallableRequest({
			mutationId: 'child-save-0001',
			child: {
				id: 42,
				firstName: '  Noelle ',
				lastName: ' Elf ',
				dateOfBirth: new Date('2020-12-15T00:00:00.000Z'),
				toyType: 'girls',
			},
		}, { uid: 'user-draft' }))).resolves.toBe(true);

		expect(adminMock.transactionSet).toHaveBeenCalledWith(
		expect.objectContaining({ path: 'registrations/user-draft' }),
		expect.objectContaining({
			children: [expect.objectContaining({
				id: 42,
				firstName: 'Noelle',
				lastName: 'Elf',
				programYearAdded: 2025,
				enabled: true,
			})],
		}),
		expect.anything(),
	);
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(1);
	});

	it('requires an existing eligible child before selecting an enabled slot', async () => {
		const { setDraftAppointment } = await loadAccountRegistrationHandlers(adminMock);
		seedDraft();
		adminMock.setDocSnapshot('dateTimeSlots/slot-1', {
			id: 'slot-1',
			programYear: 2025,
			enabled: true,
			maxSlots: 10,
			dateTime: new Date('2025-12-10T18:00:00.000Z'),
		});
		adminMock.setDocSnapshot(
			'registrations/user-draft/mutationReceipts/slot-set-0001',
			{},
			false,
		);

		await expect(setDraftAppointment(createCallableRequest({
			mutationId: 'slot-set-0001',
			slotId: 'slot-1',
		}, { uid: 'user-draft' }))).rejects.toMatchObject({
			code: 'failed-precondition',
		});
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
	});

	it('deletes only a child owned by the authenticated draft registration', async () => {
		const { deleteDraftChild } = await loadAccountRegistrationHandlers(adminMock);
		seedDraft([{
			id: 42,
			firstName: 'Noelle',
			lastName: 'Elf',
			dateOfBirth: new Date('2020-12-15T00:00:00.000Z'),
			toyType: 'girls',
		}]);
		adminMock.setDocSnapshot(
			'registrations/user-draft/mutationReceipts/child-delete-0001',
			{},
			false,
		);

		await expect(deleteDraftChild(createCallableRequest({
			mutationId: 'child-delete-0001',
			childId: 42,
		}, { uid: 'user-draft' }))).resolves.toBe(true);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'registrations/user-draft' }),
			{ children: [] },
			expect.anything(),
		);
	});
});
