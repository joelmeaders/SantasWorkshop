import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';
import { PROGRAM_YEAR } from '../../../src/utility/runtime-config';

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
		adminMock.setDocSnapshot('_testConfig/publicParameters', {
			registrationEnabled: true,
			admin: { preRegistrationEnabled: true },
		});
	};

	it('stores a server-canonical child and a replay receipt', async () => {
		const { saveDraftChild } =
			await loadAccountRegistrationHandlers(adminMock);
		seedDraft();
		adminMock.setDocSnapshot(
			'registrations/user-draft/mutationReceipts/child-save-0001',
			{},
			false,
		);

		await expect(
			saveDraftChild(
				createCallableRequest(
					{
						mutationId: 'child-save-0001',
						child: {
							id: 42,
							firstName: '  Noelle ',
							lastName: ' Elf ',
							dateOfBirth: new Date('2020-12-15T00:00:00.000Z'),
							toyType: 'girls',
						},
					},
					{ uid: 'user-draft' },
				),
			),
		).resolves.toBe(true);

		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'registrations/user-draft' }),
			expect.objectContaining({
				children: [
					expect.objectContaining({
						id: 42,
						firstName: 'Noelle',
						lastName: 'Elf',
						programYearAdded: 2025,
						enabled: true,
					}),
				],
			}),
			expect.anything(),
		);
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(1);
	});

	it('rejects a child who is age 12 before writing the draft', async () => {
		const { saveDraftChild } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			saveDraftChild(
				createCallableRequest(
					{
						mutationId: 'child-save-0012',
						child: {
							id: 42,
							firstName: 'Older',
							lastName: 'Elf',
							dateOfBirth: new Date(PROGRAM_YEAR - 12, 11, 31),
							toyType: 'girls',
						},
					},
					{ uid: 'user-draft' },
				),
			),
		).rejects.toMatchObject({
			code: 'invalid-argument',
		});
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('requires an existing eligible child before selecting an enabled slot', async () => {
		const { setDraftAppointment } =
			await loadAccountRegistrationHandlers(adminMock);
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

		await expect(
			setDraftAppointment(
				createCallableRequest(
					{
						mutationId: 'slot-set-0001',
						slotId: 'slot-1',
					},
					{ uid: 'user-draft' },
				),
			),
		).rejects.toMatchObject({
			code: 'failed-precondition',
		});
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
	});

	it('deletes only a child owned by the authenticated draft registration', async () => {
		const { deleteDraftChild } =
			await loadAccountRegistrationHandlers(adminMock);
		seedDraft([
			{
				id: 42,
				firstName: 'Noelle',
				lastName: 'Elf',
				dateOfBirth: new Date('2020-12-15T00:00:00.000Z'),
				toyType: 'girls',
			},
		]);
		adminMock.setDocSnapshot(
			'registrations/user-draft/mutationReceipts/child-delete-0001',
			{},
			false,
		);

		await expect(
			deleteDraftChild(
				createCallableRequest(
					{
						mutationId: 'child-delete-0001',
						childId: 42,
					},
					{ uid: 'user-draft' },
				),
			),
		).resolves.toBe(true);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'registrations/user-draft' }),
			{ children: [] },
			expect.anything(),
		);
	});
	const childInput = {
		id: 42,
		firstName: 'Noelle',
		lastName: 'Elf',
		dateOfBirth: '2020-12-15',
		toyType: 'girls',
	};
	const receiptPath =
		'registrations/user-draft/mutationReceipts/child-mutation-001';

	it.each(['saveDraftChild', 'deleteDraftChild'] as const)(
		'%s returns an existing receipt even after submission and closure',
		async (operation) => {
			const handlers = await loadAccountRegistrationHandlers(adminMock);
			adminMock.setDocSnapshot('registrations/user-draft', {
				registrationSubmittedOn: new Date(),
				children: [],
			});
			adminMock.setDocSnapshot('_testConfig/publicParameters', {
				registrationEnabled: false,
			});
			adminMock.setDocSnapshot(receiptPath, { operation, result: true });
			const request = createCallableRequest(
				{
					mutationId: 'child-mutation-001',
					...(operation === 'saveDraftChild'
						? { child: childInput }
						: { childId: 42 }),
				},
				{ uid: 'user-draft' },
			);
			const result =
				operation === 'saveDraftChild'
					? handlers.saveDraftChild(
							request as Parameters<
								typeof handlers.saveDraftChild
							>[0],
						)
					: handlers.deleteDraftChild(
							request as Parameters<
								typeof handlers.deleteDraftChild
							>[0],
						);
			await expect(result).resolves.toBe(true);
			expect(adminMock.transactionSet).not.toHaveBeenCalled();
			expect(adminMock.transactionCreate).not.toHaveBeenCalled();
		},
	);

	it('rejects a receipt belonging to another operation without writing', async () => {
		const { deleteDraftChild } =
			await loadAccountRegistrationHandlers(adminMock);
		seedDraft();
		adminMock.setDocSnapshot(receiptPath, {
			operation: 'saveDraftChild',
			result: true,
		});
		await expect(
			deleteDraftChild(
				createCallableRequest(
					{ mutationId: 'child-mutation-001', childId: 42 },
					{ uid: 'user-draft' },
				),
			),
		).rejects.toMatchObject({ code: 'already-exists' });
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('replaces a matching child without mutating the read snapshot on transaction retry', async () => {
		const { saveDraftChild } =
			await loadAccountRegistrationHandlers(adminMock);
		const children = [
			{ ...childInput, firstName: 'Old' },
			{ ...childInput, id: 43 },
		];
		seedDraft(children);
		adminMock.setDocSnapshot(receiptPath, {}, false);
		const run = adminMock.runTransaction.getMockImplementation();
		if (!run) throw new Error('Transaction fixture is missing.');
		adminMock.runTransaction.mockImplementation(async (callback) => {
			await run(callback);
			await run(callback);
		});
		await saveDraftChild(
			createCallableRequest(
				{ mutationId: 'child-mutation-001', child: childInput },
				{ uid: 'user-draft' },
			),
		);
		expect(children[0].firstName).toBe('Old');
		for (const [, update] of adminMock.transactionSet.mock.calls) {
			expect(update.children).toHaveLength(2);
			expect(update.children[0]).toMatchObject({
				id: 42,
				firstName: 'Noelle',
			});
			expect(update.children[1]).toEqual(children[1]);
		}
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(2);
		// The fake retries the callback; atomic persistence is verified by emulator tests.
	});

	it.each(['missing', 'submitted', 'closed', 'child-not-found'])(
		'rejects %s state without a receipt or child write',
		async (state) => {
			const { deleteDraftChild } =
				await loadAccountRegistrationHandlers(adminMock);
			seedDraft();
			adminMock.setDocSnapshot(receiptPath, {}, false);
			if (state === 'missing')
				adminMock
					.getDocRef('registrations/user-draft')
					.get.mockResolvedValue({
						exists: false,
						data: () => undefined,
					});
			if (state === 'submitted')
				adminMock.setDocSnapshot('registrations/user-draft', {
					registrationSubmittedOn: new Date(),
				});
			if (state === 'closed')
				adminMock.setDocSnapshot('_testConfig/publicParameters', {
					registrationEnabled: false,
				});
			await expect(
				deleteDraftChild(
					createCallableRequest(
						{ mutationId: 'child-mutation-001', childId: 42 },
						{ uid: 'user-draft' },
					),
				),
			).rejects.toMatchObject({
				code:
					state === 'missing' || state === 'child-not-found'
						? 'not-found'
						: 'failed-precondition',
			});
			expect(adminMock.transactionSet).not.toHaveBeenCalled();
			expect(adminMock.transactionCreate).not.toHaveBeenCalled();
		},
	);

	it('rejects unauthenticated or foreign-record payloads before any transaction', async () => {
		const { deleteDraftChild } =
			await loadAccountRegistrationHandlers(adminMock);
		const request = createCallableRequest({
			mutationId: 'child-mutation-001',
			childId: 42,
		});
		await expect(
			deleteDraftChild({ ...request, auth: undefined }),
		).rejects.toMatchObject({ code: 'unauthenticated' });
		await expect(
			deleteDraftChild({
				...request,
				data: { ...request.data, uid: 'someone-else' },
			} as typeof request),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(adminMock.runTransaction).not.toHaveBeenCalled();
	});
});
