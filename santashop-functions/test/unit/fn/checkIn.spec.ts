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

describe('checkIn handler', () => {
	let adminMock: CheckInAdminMock;

	beforeEach(() => {
		adminMock = createCheckInAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		generateQrCodeMock.mockResolvedValue(undefined);
		generateIdMock.mockReturnValue('ZXCV2345');
		recordCheckInRaceAttemptMock.mockReset();
	});

	it('rejects non-admin callers', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);

		await expect(
			checkIn(
				createCallableRequest(createRegistration(), { admin: false }),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('allows a dedicated check-in role but rejects unsupported scan input', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);

		await expect(
			checkIn(
				createCallableRequest(
					{
						registration: createRegistration(),
						inputMethod: 'keyboard',
					},
					{ roles: ['checkin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects incomplete, missing, or stale registrations before writing', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);
		const incomplete = createRegistration({ children: [] });
		await expect(
			checkIn(
				createCallableRequest(
					{ registration: incomplete, inputMethod: 'manual' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({
			code: 'failed-precondition',
			message: '-11',
		});

		await expect(
			checkIn(
				createCallableRequest(
					{
						registration: createRegistration(),
						inputMethod: 'manual',
					},
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'not-found' });
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('rejects an altered QR code using the authoritative registration', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/test-user-123', {
			...createRegistration(),
			qrcode: 'authoritative-code',
			registrationSubmittedOn: new Date(),
		});

		await expect(
			checkIn(
				createCallableRequest(
					{
						registration: createRegistration(),
						inputMethod: 'camera',
					},
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('records a race attempt and returns an already-exists error without a second write', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);
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
			checkIn(
				createCallableRequest(
					{ registration, inputMethod: 'camera' },
					{ admin: true, uid: 'staff-1' },
				),
			),
		).rejects.toMatchObject({
			code: 'already-exists',
			details: { blocked: true },
		});
		expect(recordCheckInRaceAttemptMock).toHaveBeenCalledWith(
			expect.objectContaining({ qrcode: registration.qrcode }),
			'staff-1',
			'camera',
		);
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('maps transaction conflict errors to already-exists', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);
		adminMock.runTransaction.mockRejectedValue({
			code: 6,
			message: 'conflict',
		});

		await expect(
			checkIn(
				createCallableRequest(
					{
						registration: createRegistration(),
						inputMethod: 'manual',
					},
					{ admin: true },
				),
			),
		).rejects.toMatchObject({
			code: 'already-exists',
			message: 'conflict',
		});
	});

	it('creates a check-in record and returns the child count', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);
		const checkinDoc = adminMock.getDocRef('checkins/test-user-123');
		adminMock.setDocSnapshot('registrations/test-user-123', {
			...createRegistration(),
			registrationSubmittedOn: new Date(),
		});
		checkinDoc.create.mockResolvedValue(undefined);

		const result = await checkIn(
			createCallableRequest(
				{ registration: createRegistration(), inputMethod: 'camera' },
				{ admin: true },
			),
		);

		expect(result).toBe(1);
		expect(adminMock.transactionCreate).toHaveBeenCalledWith(
			checkinDoc,
			expect.objectContaining({ customerId: 'test-user-123' }),
		);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			adminMock.getDocRef('registrations/test-user-123'),
			{ hasCheckedIn: true },
			{ merge: true },
		);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			adminMock.getDocRef(`stats/checkin-${PROGRAM_YEAR}`),
			expect.objectContaining({
				dateTimeCount: [
					expect.objectContaining({
						customerCount: 1,
						childCount: 1,
					}),
				],
			}),
			{ merge: false },
		);
	});
});
