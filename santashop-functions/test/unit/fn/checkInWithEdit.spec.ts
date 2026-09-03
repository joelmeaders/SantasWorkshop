import { beforeEach, describe, expect, it } from 'vitest';
import { createRegistration } from '../../fixtures/factories';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createCheckInAdminMock,
	type CheckInAdminMock,
	generateIdMock,
	generateQrCodeMock,
	loadCheckInAdminHandlers,
	recordCheckInRaceAttemptMock,
} from '../helpers/checkin-admin.unit-helper';
import { PROGRAM_YEAR } from '../../../src/utility/runtime-config';

describe('checkInWithEdit handler', () => {
	let adminMock: CheckInAdminMock;

	beforeEach(() => {
		adminMock = createCheckInAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		generateQrCodeMock.mockResolvedValue(undefined);
		generateIdMock.mockReturnValue('ZXCV2345');
		recordCheckInRaceAttemptMock.mockReset();
	});

	it('creates edited registration and check-in records', async () => {
		const { checkInWithEdit } = await loadCheckInAdminHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/test-user-123', {
			...createRegistration(),
			registrationSubmittedOn: new Date(),
		});

		const result = await checkInWithEdit(
			createCallableRequest(
				{ registration: createRegistration(), inputMethod: 'manual' },
				{ admin: true },
			),
		);

		expect(result).toBe(1);
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(2);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			adminMock.getDocRef('registrations/test-user-123'),
			{ hasCheckedIn: true },
			{ merge: true },
		);
		expect(adminMock.doc).toHaveBeenCalledWith(
			'editedregistrations/test-user-123',
		);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			adminMock.getDocRef(`stats/checkin-${PROGRAM_YEAR}`),
			expect.objectContaining({
				dateTimeCount: [expect.objectContaining({ modifiedCount: 1 })],
			}),
			{ merge: false },
		);
	});

	it('accepts owner and check-in role claims but validates the input method', async () => {
		const { checkInWithEdit } = await loadCheckInAdminHandlers(adminMock);
		await expect(
			checkInWithEdit(
				createCallableRequest(
					{
						registration: createRegistration(),
						inputMethod: 'barcode',
					},
					{ owner: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('does not create edited records for an incomplete or cancelled source registration', async () => {
		const { checkInWithEdit } = await loadCheckInAdminHandlers(adminMock);
		await expect(
			checkInWithEdit(
				createCallableRequest(
					{
						registration: createRegistration({ children: [] }),
						inputMethod: 'manual',
					},
					{ admin: true },
				),
			),
		).rejects.toMatchObject({
			code: 'failed-precondition',
			message: '-11',
		});

		adminMock.setDocSnapshot('registrations/test-user-123', {
			...createRegistration(),
			registrationSubmittedOn: new Date(),
			cancelledOn: new Date(),
		});
		await expect(
			checkInWithEdit(
				createCallableRequest(
					{
						registration: createRegistration(),
						inputMethod: 'manual',
					},
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('records duplicate edited check-ins as a race without creating a second edited registration', async () => {
		const { checkInWithEdit } = await loadCheckInAdminHandlers(adminMock);
		const registration = {
			...createRegistration(),
			registrationSubmittedOn: new Date(),
		};
		adminMock.setDocSnapshot('registrations/test-user-123', registration);
		adminMock.setDocSnapshot('checkins/test-user-123', {
			customerId: 'test-user-123',
		});
		recordCheckInRaceAttemptMock.mockResolvedValue({ blocked: true });

		await expect(
			checkInWithEdit(
				createCallableRequest(
					{ registration, inputMethod: 'manual' },
					{ roles: ['checkin'], uid: 'staff-2' },
				),
			),
		).rejects.toMatchObject({
			code: 'already-exists',
			details: { blocked: true },
		});
		expect(recordCheckInRaceAttemptMock).toHaveBeenCalledWith(
			expect.objectContaining({ qrcode: registration.qrcode }),
			'staff-2',
			'manual',
		);
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});
});
