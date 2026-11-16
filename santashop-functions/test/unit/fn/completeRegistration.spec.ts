import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';
import { PROGRAM_YEAR } from '../../../src/utility/runtime-config';

const { beforeHmac } = vi.hoisted(() => ({ beforeHmac: vi.fn() }));
vi.mock('node:crypto', async (importOriginal) => {
	const crypto = await importOriginal<typeof import('node:crypto')>();
	return {
		...crypto,
		createHmac: (...args: Parameters<typeof crypto.createHmac>) => {
			beforeHmac();
			return crypto.createHmac(...args);
		},
	};
});

describe('completeRegistration handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		vi.spyOn(Date, 'now').mockReturnValue(
			Date.parse('2025-12-01T00:00:00.000Z'),
		);
		adminMock = createAccountAdminMock();
		vi.stubEnv('SANTASHOP_SUBMISSION_FINGERPRINT_KEY', undefined);
		vi.stubEnv('SANTASHOP_SUBMISSION_FINGERPRINT_KEY_ID', undefined);
	});
	afterEach(() => vi.unstubAllEnvs());

	const useFixtureKey = (): void => {
		vi.stubEnv(
			'SANTASHOP_SUBMISSION_FINGERPRINT_KEY',
			Buffer.alloc(32, 17).toString('base64'),
		);
		vi.stubEnv('SANTASHOP_SUBMISSION_FINGERPRINT_KEY_ID', 'fixture-key');
	};

	const submissionRequest = () =>
		createCallableRequest({ mutationId: 'submit-0001' }, { uid: 'user-3' });

	const seedCompletableRegistration = (
		dateOfBirth = new Date('2020-12-15T00:00:00.000Z'),
	): void => {
		adminMock.setDocSnapshot('registrations/user-3', {
			uid: 'user-3',
			qrcode: 'ABCD2345',
			qrCodeStoragePath: 'registrations/user-3/test-asset.png',
			children: [
				{
					id: 1,
					firstName: 'Noelle',
					lastName: 'Elf',
					dateOfBirth,
					toyType: 'girls',
				},
			],
			dateTimeSlot: {
				id: 'slot-1',
				dateTime: new Date('2025-12-10T18:00:00.000Z'),
			},
		});
		adminMock.setDocSnapshot('users/user-3', {
			firstName: 'Buddy',
			lastName: 'Elf',
			emailAddress: 'buddy.elf@example.com',
			zipCode: '80205',
		});
		adminMock.setDocSnapshot('_testConfig/publicParameters', {
			registrationEnabled: true,
			admin: { preRegistrationEnabled: true },
		});
		adminMock.setDocSnapshot('dateTimeSlots/slot-1', {
			id: 'slot-1',
			programYear: 2025,
			enabled: true,
			maxSlots: 10,
			dateTime: new Date('2025-12-10T18:00:00.000Z'),
		});
		adminMock.setDocSnapshot(
			'registrations/user-3/mutationReceipts/submit-0001',
			{},
			false,
		);
	};

	it('loads canonical data and writes registration side effects without updating the slot', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		seedCompletableRegistration();

		const result = await completeRegistration(
			createCallableRequest(
				{ mutationId: 'submit-0001' },
				{ uid: 'user-3' },
			),
		);

		expect(result).toBe(true);
		expect(adminMock.transactionSet).toHaveBeenCalledTimes(2);
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(2);
		expect(beforeHmac).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'registrations/user-3/mutationReceipts/submit-0001',
			}),
			{
				operation: 'completeRegistration',
				result: true,
				completedOn: expect.any(Date),
			},
		);
		expect(adminMock.doc).toHaveBeenCalledWith('registrations/user-3');
		expect(adminMock.doc).toHaveBeenCalledWith('users/user-3');
		expect(adminMock.doc).toHaveBeenCalledWith('dateTimeSlots/slot-1');
		expect(adminMock.transactionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'tmp_registrationemails/generated-id',
			}),
			expect.objectContaining({
				registrationUid: 'user-3',
				appointmentSlotId: 'slot-1',
				queueSource: 'registration-completion',
				code: 'ABCD2345',
				qrCodeStoragePath: 'registrations/user-3/test-asset.png',
			}),
		);
		expect(adminMock.doc).toHaveBeenCalledWith(
			'registrationsearchindex/user-3',
		);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'registrationsearchindex/user-3' }),
			expect.objectContaining({ code: 'ABCD2345' }),
			{ merge: true },
		);
	});

	it('records optional evidence only on the same real completion transaction receipt', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		seedCompletableRegistration();
		useFixtureKey();
		await expect(completeRegistration(submissionRequest())).resolves.toBe(
			true,
		);
		expect(adminMock.runTransaction).toHaveBeenCalledTimes(1);
		expect(adminMock.transactionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'registrations/user-3/mutationReceipts/submit-0001',
			}),
			{
				operation: 'completeRegistration',
				result: true,
				completedOn: expect.any(Date),
				submissionFingerprint: {
					version: 1,
					keyId: 'fixture-key',
					hmacSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
				},
			},
		);
		expect(
			adminMock.transactionSet.mock.calls.every(
				([, record]) => !Object.hasOwn(record, 'submissionFingerprint'),
			),
		).toBe(true);
	});

	it('finishes registration without evidence when fingerprint computation fails', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		seedCompletableRegistration();
		useFixtureKey();
		beforeHmac.mockImplementationOnce(() => {
			throw new Error('Synthetic HMAC failure');
		});
		await expect(completeRegistration(submissionRequest())).resolves.toBe(
			true,
		);
		expect(beforeHmac).toHaveBeenCalledTimes(1);
		expect(adminMock.transactionSet).toHaveBeenCalledTimes(2);
		expect(adminMock.transactionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'registrations/user-3/mutationReceipts/submit-0001',
			}),
			{
				operation: 'completeRegistration',
				result: true,
				completedOn: expect.any(Date),
			},
		);
	});

	it('does not generate evidence for a no-op on an already-submitted registration', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		seedCompletableRegistration();
		useFixtureKey();
		adminMock.setDocSnapshot('registrations/user-3', {
			registrationSubmittedOn: new Date(),
		});
		await expect(completeRegistration(submissionRequest())).resolves.toBe(
			true,
		);
		expect(beforeHmac).not.toHaveBeenCalled();
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(1);
		expect(adminMock.transactionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'registrations/user-3/mutationReceipts/submit-0001',
			}),
			{
				operation: 'completeRegistration',
				result: true,
				completedOn: expect.any(Date),
			},
		);
	});

	it('rejects an age 12 child before writing completion side effects', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		seedCompletableRegistration(new Date(PROGRAM_YEAR - 12, 11, 31));

		await expect(
			completeRegistration(
				createCallableRequest(
					{ mutationId: 'submit-0001' },
					{ uid: 'user-3' },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('rejects unsupported client registration fields', async () => {
		const { completeRegistration } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			completeRegistration(
				createCallableRequest({
					mutationId: 'submit-0001',
					uid: 'other',
				}),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it.each([
		undefined,
		{ version: 1, keyId: 'retired-key', hmacSha256: 'f'.repeat(64) },
	])(
		'returns the stored result without rewriting a receipt: %j',
		async (submissionFingerprint) => {
			useFixtureKey();
			const { completeRegistration } =
				await loadAccountRegistrationHandlers(adminMock);
			seedCompletableRegistration();
			adminMock.setDocSnapshot(
				'registrations/user-3/mutationReceipts/submit-0001',
				{
					operation: 'completeRegistration',
					result: true,
					...(submissionFingerprint ? { submissionFingerprint } : {}),
				},
			);

			await expect(
				completeRegistration(
					createCallableRequest(
						{ mutationId: 'submit-0001' },
						{ uid: 'user-3' },
					),
				),
			).resolves.toBe(true);
			expect(beforeHmac).not.toHaveBeenCalled();
			expect(adminMock.transactionSet).not.toHaveBeenCalled();
			expect(adminMock.transactionCreate).not.toHaveBeenCalled();
		},
	);
});
