import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createDefaultPublicParameters,
	type PublicParameters,
} from '../../../src/models';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

const gatewayFetch = vi.fn();
const uid = 'settings-customer';
const mutationId = 'settings-mutation-001';
const registrationPath = `registrations/${uid}`;
const receiptPath = `${registrationPath}/mutationReceipts/${mutationId}`;
const child = {
	id: 42,
	firstName: 'Noelle',
	lastName: 'Elf',
	dateOfBirth: '2020-12-15',
	toyType: 'girls',
};
const draftOperations = [
	'saveDraftChild',
	'deleteDraftChild',
	'setDraftAppointment',
	'completeRegistration',
] as const;
const operations = [
	...draftOperations,
	'changeRegistrationDateTime',
	'undoRegistration',
] as const;
type Operation = (typeof operations)[number];
type Handlers = Awaited<ReturnType<typeof loadAccountRegistrationHandlers>>;

const openSettings = (): PublicParameters => {
	const settings = createDefaultPublicParameters();
	return {
		...settings,
		registrationEnabled: true,
		maintenanceModeEnabled: false,
		weatherModeEnabled: false,
		admin: {
			...settings.admin,
			preRegistrationEnabled: true,
			allowChangeRegistration: true,
			allowCancelRegistration: true,
		},
	};
};

const gatewayResponse = (
	settings = openSettings(),
	source: 'fresh' | 'stale' = 'fresh',
): Response =>
	new Response(
		JSON.stringify({ settings, source, lastFreshAt: Date.now() }),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		},
	);

const invoke = (handlers: Handlers, operation: Operation): Promise<true> => {
	const payload = {
		mutationId,
		...(operation === 'saveDraftChild' ? { child } : {}),
		...(operation === 'deleteDraftChild' ? { childId: child.id } : {}),
		...(['setDraftAppointment', 'changeRegistrationDateTime'].includes(
			operation,
		)
			? { slotId: 'new-slot' }
			: {}),
	};
	return handlers[operation](
		createCallableRequest(payload, { uid }) as never,
	);
};

describe('registration mutations use authoritative public settings', () => {
	let adminMock: AccountAdminMock;
	let handlers: Handlers;

	beforeEach(async () => {
		vi.spyOn(Date, 'now').mockReturnValue(
			Date.parse('2025-12-01T00:00:00.000Z'),
		);
		vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
		vi.stubEnv(
			'SANTASHOP_REMOTE_CONFIG_GATEWAY_URL',
			'https://publicparametersgateway-test.a.run.app',
		);
		vi.stubGlobal('fetch', gatewayFetch);
		gatewayFetch.mockResolvedValue(gatewayResponse());
		vi.doMock('google-auth-library', () => ({
			GoogleAuth: class {
				public async getIdTokenClient(): Promise<object> {
					return {
						idTokenProvider: {
							fetchIdToken: async (): Promise<string> =>
								'test-token',
						},
					};
				}
			},
		}));
		adminMock = createAccountAdminMock();
		handlers = await loadAccountRegistrationHandlers(adminMock, {
			useRealPublicParameters: true,
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.doUnmock('google-auth-library');
	});

	const seed = (operation: Operation): void => {
		adminMock.setDocSnapshot(registrationPath, {
			uid,
			qrcode: 'ABCD2345',
			qrCodeStoragePath: `registrations/${uid}/qr.png`,
			children: [child],
			firstName: 'Buddy',
			emailAddress: 'buddy@example.test',
			dateTimeSlot: {
				id: 'old-slot',
				dateTime: new Date('2025-12-10T18:00:00.000Z'),
			},
			...(['changeRegistrationDateTime', 'undoRegistration'].includes(
				operation,
			)
				? {
						registrationSubmittedOn: new Date(
							'2025-12-01T00:00:00.000Z',
						),
					}
				: {}),
		});
		adminMock.setDocSnapshot(`users/${uid}`, {
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'buddy@example.test',
			zipCode: '80205',
		});
		for (const id of ['old-slot', 'new-slot']) {
			adminMock.setDocSnapshot(`dateTimeSlots/${id}`, {
				id,
				programYear: 2025,
				enabled: true,
				maxSlots: 10,
				dateTime: new Date('2025-12-10T18:00:00.000Z'),
			});
		}
		adminMock.setDocSnapshot(receiptPath, {}, false);
	};

	const expectNoWrites = (): void => {
		for (const write of [
			adminMock.transactionSet,
			adminMock.transactionCreate,
			adminMock.transactionUpdate,
			adminMock.transactionDelete,
			adminMock.batchSet,
			adminMock.batchCreate,
			adminMock.batchDelete,
		])
			expect(write).not.toHaveBeenCalled();
	};

	it.each(operations)(
		'%s waits for delayed open settings on its first invocation',
		async (operation) => {
			seed(operation);
			let resolveResponse!: (response: Response) => void;
			gatewayFetch.mockReturnValue(
				new Promise<Response>((resolve) => {
					resolveResponse = resolve;
				}),
			);
			const result = invoke(handlers, operation);
			await vi.waitFor(() => expect(gatewayFetch).toHaveBeenCalledOnce());
			expectNoWrites();
			resolveResponse(gatewayResponse());
			await expect(result).resolves.toBe(true);
			expect(adminMock.transactionCreate).toHaveBeenCalledWith(
				expect.objectContaining({ path: receiptPath }),
				expect.objectContaining({ operation, result: true }),
			);
		},
	);

	describe.each(operations)('%s', (operation) => {
		it.each(['stale', 'unavailable'] as const)(
			'does not write with %s settings',
			async (failure) => {
				seed(operation);
				if (failure === 'stale')
					gatewayFetch.mockResolvedValue(
						gatewayResponse(openSettings(), 'stale'),
					);
				else
					gatewayFetch.mockRejectedValue(
						new Error('Gateway unavailable'),
					);
				await expect(invoke(handlers, operation)).rejects.toMatchObject(
					{ code: 'unavailable' },
				);
				expectNoWrites();
			},
		);

		it('returns a successful receipt without reading unavailable settings', async () => {
			seed(operation);
			adminMock.setDocSnapshot(receiptPath, { operation, result: true });
			gatewayFetch.mockRejectedValue(new Error('Gateway unavailable'));
			await expect(invoke(handlers, operation)).resolves.toBe(true);
			expect(gatewayFetch).not.toHaveBeenCalled();
			expectNoWrites();
		});

		it('fetches once across transaction retries and again for the next invocation', async () => {
			seed(operation);
			const run = adminMock.runTransaction.getMockImplementation();
			if (!run) throw new Error('Transaction fixture is missing.');
			adminMock.runTransaction.mockImplementation(async (callback) => {
				await run(callback);
				await run(callback);
			});
			// The fixture retries callbacks without committing state, as in the draft tests.
			await expect(invoke(handlers, operation)).resolves.toBe(true);
			expect(gatewayFetch).toHaveBeenCalledOnce();
			gatewayFetch.mockResolvedValue(gatewayResponse());
			await expect(invoke(handlers, operation)).resolves.toBe(true);
			expect(gatewayFetch).toHaveBeenCalledTimes(2);
		});
	});

	describe.each(draftOperations)('%s closure gates', (operation) => {
		it.each([
			'registration',
			'pre-registration',
			'maintenance',
			'weather',
		] as const)('rejects %s closure without side effects', async (gate) => {
			seed(operation);
			const settings = openSettings();
			if (gate === 'registration') settings.registrationEnabled = false;
			if (gate === 'pre-registration')
				settings.admin.preRegistrationEnabled = false;
			if (gate === 'maintenance') settings.maintenanceModeEnabled = true;
			if (gate === 'weather') settings.weatherModeEnabled = true;
			gatewayFetch.mockResolvedValue(gatewayResponse(settings));
			await expect(invoke(handlers, operation)).rejects.toMatchObject({
				code: 'failed-precondition',
			});
			expectNoWrites();
		});
	});

	it.each(['changeRegistrationDateTime', 'undoRegistration'] as const)(
		'%s retains its action-specific closure gate',
		async (operation) => {
			seed(operation);
			const settings = openSettings();
			if (operation === 'changeRegistrationDateTime')
				settings.admin.allowChangeRegistration = false;
			else settings.admin.allowCancelRegistration = false;
			gatewayFetch.mockResolvedValue(gatewayResponse(settings));
			await expect(invoke(handlers, operation)).rejects.toMatchObject({
				code: 'failed-precondition',
			});
			expectNoWrites();
		},
	);

	it.each([false, true])(
		'preserves an already-submitted completion without settings (waiting list active=%s)',
		async (active) => {
			seed('completeRegistration');
			adminMock.setDocSnapshot(registrationPath, {
				uid,
				registrationSubmittedOn: new Date(),
				waitingList: { active },
			});
			gatewayFetch.mockRejectedValue(new Error('Gateway unavailable'));
			await expect(
				invoke(handlers, 'completeRegistration'),
			).resolves.toBe(true);
			expect(gatewayFetch).not.toHaveBeenCalled();
			expect(adminMock.transactionSet).not.toHaveBeenCalled();
			expect(adminMock.transactionCreate).toHaveBeenCalledOnce();
			expect(adminMock.transactionCreate).toHaveBeenCalledWith(
				expect.objectContaining({ path: receiptPath }),
				expect.objectContaining({
					operation: 'completeRegistration',
					result: true,
				}),
			);
			expect(adminMock.transactionUpdate).toHaveBeenCalledTimes(
				active ? 1 : 0,
			);
			if (active)
				expect(adminMock.transactionUpdate).toHaveBeenCalledWith(
					expect.objectContaining({ path: registrationPath }),
					{ 'waitingList.active': false },
				);
		},
	);
});
