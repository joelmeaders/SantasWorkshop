import { describe, expect, it, vi } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

// Reuse each loaded handler and mock dependency across separate accounts, as a warm worker would.
const householdUids = ['household-a', 'household-b'] as const;
const childNames = { 'household-a': 'Alice', 'household-b': 'Brian' } as const;
const storedNames = {
	'household-a': 'Noelle',
	'household-b': 'Beatrice',
} as const;

describe('ordinary distinct-account requests in the same loaded Functions module', () => {
	for (const order of ['sequential', 'interleaved'] as const) {
		it(
			'keeps both child-save targets and payloads distinct: ' + order,
			async () => {
				const mock = createAccountAdminMock();
				const { saveDraftChild } =
					await loadAccountRegistrationHandlers(mock);
				mock.setDocSnapshot('_testConfig/publicParameters', {
					registrationEnabled: true,
					admin: { preRegistrationEnabled: true },
				});
				for (const uid of householdUids) {
					mock.setDocSnapshot('registrations/' + uid, {
						uid,
						children: [{ id: 1, firstName: storedNames[uid] }],
					});
					mock.setDocSnapshot(
						'registrations/' +
							uid +
							'/mutationReceipts/local-child-001',
						{},
						false,
					);
				}
				const submit = (uid: (typeof householdUids)[number]) =>
					saveDraftChild(
						createCallableRequest(
							{
								mutationId: 'local-child-001',
								child: {
									id: 8,
									firstName: childNames[uid],
									lastName: 'Fixture',
									dateOfBirth: '2020-12-15',
									toyType: 'girls',
								},
							},
							{ uid },
						),
					);

				if (order === 'sequential') {
					await expect(submit(householdUids[0])).resolves.toBe(true);
					await expect(submit(householdUids[1])).resolves.toBe(true);
				} else {
					// Pause the first read so the second request completes inside the same module.
					const readA = mock.getDocRef(
						'registrations/' + householdUids[0],
					).get;
					const snapshot = await readA();
					const entered = Promise.withResolvers<void>();
					const delayedRead =
						Promise.withResolvers<typeof snapshot>();
					readA.mockImplementationOnce(() => {
						entered.resolve();
						return delayedRead.promise;
					});
					const first = submit(householdUids[0]);
					await entered.promise;
					await expect(submit(householdUids[1])).resolves.toBe(true);
					expect(
						mock.transactionSet.mock.calls.map(([ref]) => ref.path),
					).toEqual(['registrations/' + householdUids[1]]);
					delayedRead.resolve(snapshot);
					await expect(first).resolves.toBe(true);
				}

				for (const uid of householdUids) {
					expect(mock.transactionSet).toHaveBeenCalledWith(
						expect.objectContaining({
							path: 'registrations/' + uid,
						}),
						{
							children: [
								{ id: 1, firstName: storedNames[uid] },
								expect.objectContaining({
									id: 8,
									firstName: childNames[uid],
								}),
							],
						},
						{ merge: true },
					);
					expect(mock.transactionCreate).toHaveBeenCalledWith(
						expect.objectContaining({
							path:
								'registrations/' +
								uid +
								'/mutationReceipts/local-child-001',
						}),
						expect.objectContaining({
							operation: 'saveDraftChild',
						}),
					);
				}
				expect(mock.transactionSet).toHaveBeenCalledTimes(2);
				expect(mock.transactionCreate).toHaveBeenCalledTimes(2);
			},
		);
	}

	it('pairs concurrent completion writes with each account’s canonical roster, email and index', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(
			Date.parse('2025-12-01T00:00:00.000Z'),
		);
		const mock = createAccountAdminMock();
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(mock);
		mock.setDocSnapshot('_testConfig/publicParameters', {
			registrationEnabled: true,
			admin: { preRegistrationEnabled: true },
		});
		const dateTime = new Date('2025-12-10T18:00:00.000Z');
		mock.setDocSnapshot('dateTimeSlots/slot-1', {
			id: 'slot-1',
			programYear: 2025,
			enabled: true,
			maxSlots: 10,
			slotsReserved: 0,
			dateTime,
		});

		for (const uid of householdUids) {
			mock.setDocSnapshot('registrations/' + uid, {
				uid,
				qrcode: uid === 'household-a' ? 'ABCD2345' : 'BCDE3456',
				qrCodeStoragePath: 'registrations/' + uid + '/test-asset.png',
				children: [
					{
						id: 8,
						firstName: childNames[uid],
						lastName: 'Fixture',
						dateOfBirth: '2020-12-15',
						toyType: 'girls',
					},
				],
				dateTimeSlot: { id: 'slot-1', dateTime },
			});
			mock.setDocSnapshot('users/' + uid, {
				firstName: 'Parent',
				lastName: 'Fixture',
				emailAddress: uid + '@example.com',
				zipCode: '80205',
			});
			mock.setDocSnapshot(
				'registrations/' + uid + '/mutationReceipts/local-submit-001',
				{},
				false,
			);
		}

		await expect(
			Promise.all(
				householdUids.map((uid) =>
					completeRegistration(
						createCallableRequest(
							{ mutationId: 'local-submit-001' },
							{ uid },
						),
					),
				),
			),
		).resolves.toEqual([true, true]);

		for (const uid of householdUids) {
			expect(mock.transactionSet).toHaveBeenCalledWith(
				expect.objectContaining({ path: 'registrations/' + uid }),
				expect.objectContaining({
					uid,
					emailAddress: uid + '@example.com',
					children: [
						expect.objectContaining({ firstName: childNames[uid] }),
					],
				}),
			);
			expect(mock.transactionSet).toHaveBeenCalledWith(
				expect.objectContaining({
					path: 'registrationsearchindex/' + uid,
				}),
				expect.objectContaining({
					customerId: uid,
					emailAddress: uid + '@example.com',
				}),
				{ merge: true },
			);
			expect(mock.transactionCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					path: 'tmp_registrationemails/generated-id',
				}),
				expect.objectContaining({ registrationUid: uid }),
			);
			expect(mock.transactionCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					path:
						'registrations/' +
						uid +
						'/mutationReceipts/local-submit-001',
				}),
				expect.objectContaining({ operation: 'completeRegistration' }),
			);
		}
	});
});

it('keeps concurrent reusable-wrapper log metadata on the matching request', async () => {
	vi.resetModules();
	const info = vi.fn();
	vi.doMock('firebase-functions/logger', () => ({
		debug: vi.fn(),
		info,
		warn: vi.fn(),
		error: vi.fn(),
	}));
	const { observeCallableHandler } =
		await import('../../../src/utility/observability');
	const held = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	const handler = observeCallableHandler(
		'read-only-fixture',
		async (request) => {
			if (request.auth?.uid === 'household-a') {
				started.resolve();
				await held.promise;
			}
			return request.auth?.uid;
		},
	);
	const a = handler(
		createCallableRequest({ firstField: 'local' }, { uid: 'household-a' }),
	);
	await started.promise;
	await expect(
		handler(
			createCallableRequest(
				{ secondField: 'local' },
				{ uid: 'household-b' },
			),
		),
	).resolves.toBe('household-b');
	held.resolve();
	await expect(a).resolves.toBe('household-a');
	expect(
		info.mock.calls.map(([label, meta]) => [
			label,
			meta.authUid,
			meta.dataKeys,
		]),
	).toEqual([
		['Function invocation started', 'household-a', ['firstField']],
		['Function invocation started', 'household-b', ['secondField']],
		['Function invocation succeeded', 'household-b', ['secondField']],
		['Function invocation succeeded', 'household-a', ['firstField']],
	]);
});
