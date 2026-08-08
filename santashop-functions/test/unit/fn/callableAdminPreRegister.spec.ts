import { beforeEach, describe, expect, it } from 'vitest';
import { createRegistration } from '../../fixtures/factories';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createCheckInAdminMock,
	type CheckInAdminMock,
	deleteQrCodeMock,
	generateIdMock,
	generateQrCodeMock,
	loadCheckInAdminHandlers,
} from '../helpers/checkin-admin.unit-helper';

describe('callableAdminPreRegister handler', () => {
	let adminMock: CheckInAdminMock;

	beforeEach(() => {
		adminMock = createCheckInAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		generateQrCodeMock.mockResolvedValue(undefined);
		deleteQrCodeMock.mockResolvedValue(undefined);
		generateIdMock.mockReturnValue('ZXCV2345');
	});

	it('rejects non-admin callers', async () => {
		const { callableAdminPreRegister } =
			await loadCheckInAdminHandlers(adminMock);

		await expect(
			callableAdminPreRegister(
				createCallableRequest(createRegistration(), { admin: false }),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('validates required account fields before attempting to create Auth users', async () => {
		const { callableAdminPreRegister } =
			await loadCheckInAdminHandlers(adminMock);
		await expect(
			callableAdminPreRegister(
				createCallableRequest(
					createRegistration({ emailAddress: '' }),
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(adminMock.createUser).not.toHaveBeenCalled();
	});

	it('maps duplicate Auth emails and rolls back when the requested schedule does not exist', async () => {
		const { callableAdminPreRegister } =
			await loadCheckInAdminHandlers(adminMock);
		adminMock.createUser.mockRejectedValue({
			code: 'auth/email-already-exists',
			message: 'Already registered',
		});
		await expect(
			callableAdminPreRegister(
				createCallableRequest(createRegistration(), { admin: true }),
			),
		).rejects.toMatchObject({ code: 'already-exists' });

		adminMock.createUser.mockResolvedValue({ uid: 'pre-reg-no-slot' });
		adminMock.setDocSnapshot('dateTimeSlots/slot-1', {});
		await expect(
			callableAdminPreRegister(
				createCallableRequest(createRegistration(), { admin: true }),
			),
		).rejects.toMatchObject({ code: 'not-found' });
		expect(adminMock.deleteUser).toHaveBeenCalledWith('pre-reg-no-slot');
	});

	it('creates auth, registration, index, and email records for admins', async () => {
		const { callableAdminPreRegister } =
			await loadCheckInAdminHandlers(adminMock);
		adminMock.createUser.mockResolvedValue({ uid: 'pre-reg-123' });
		adminMock.setDocSnapshot('dateTimeSlots/slot-1', {
			dateTime: '2025-12-10T18:00:00.000Z',
		});

		const result = await callableAdminPreRegister(
			createCallableRequest(
				createRegistration({
				dateTimeSlot: {
					id: 'slot-1',
					dateTime: new Date('2025-12-10T18:00:00.000Z'),
				},
				}),
				{ admin: true },
			),
		);

		expect(result).toBe('pre-reg-123');
		expect(adminMock.createUser).toHaveBeenCalledTimes(1);
		expect(adminMock.batchCreate).toHaveBeenCalledTimes(2);
		expect(adminMock.batchSet).toHaveBeenCalledTimes(1);
		expect(generateQrCodeMock).toHaveBeenCalledWith(
			'registrations/pre-reg-123/test-asset.png',
			'ZXCV2345',
		);
		expect(
			adminMock.getDocRef('registrations/pre-reg-123').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				qrCodeGeneratedOn: expect.any(Date),
				reminderEmailQueuedOn: expect.any(Date),
			}),
			{ merge: true },
		);
		expect(
			adminMock.getDocRef('tmp_registrationemails/pre-reg-123').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				deliveryState: 'queued',
				email: 'buddy.elf@example.com',
			}),
			{ merge: true },
		);
	});

	it('rolls back the auth user when registration persistence fails', async () => {
		const { callableAdminPreRegister } =
			await loadCheckInAdminHandlers(adminMock);
		adminMock.createUser.mockResolvedValue({ uid: 'pre-reg-rollback' });
		adminMock.setDocSnapshot('dateTimeSlots/slot-1', {
			dateTime: '2025-12-10T18:00:00.000Z',
		});
		adminMock.batchCommit.mockRejectedValue(new Error('batch failed'));

		await expect(
			callableAdminPreRegister(
				createCallableRequest(
					createRegistration({
					dateTimeSlot: {
						id: 'slot-1',
						dateTime: new Date('2025-12-10T18:00:00.000Z'),
					},
					}),
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'internal' });
		expect(adminMock.deleteUser).toHaveBeenCalledWith('pre-reg-rollback');
	});

	it('rolls back preregistration when qr generation fails after persistence', async () => {
		const { callableAdminPreRegister } =
			await loadCheckInAdminHandlers(adminMock);
		adminMock.createUser.mockResolvedValue({ uid: 'pre-reg-qr' });
		adminMock.setDocSnapshot('dateTimeSlots/slot-1', {
			dateTime: '2025-12-10T18:00:00.000Z',
		});
		generateQrCodeMock.mockRejectedValueOnce(new Error('qr failed'));

		await expect(
			callableAdminPreRegister(
				createCallableRequest(
					createRegistration({
					dateTimeSlot: {
						id: 'slot-1',
						dateTime: new Date('2025-12-10T18:00:00.000Z'),
					},
					}),
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'internal' });
		expect(adminMock.deleteUser).toHaveBeenCalledWith('pre-reg-qr');
		expect(deleteQrCodeMock).toHaveBeenCalledWith(
			'registrations/pre-reg-qr/test-asset.png',
		);
	});
});
