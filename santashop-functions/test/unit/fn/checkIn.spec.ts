import { beforeEach, describe, expect, it } from 'vitest';
import { createRegistration } from '../../fixtures/factories';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createCheckInAdminMock,
	type CheckInAdminMock,
	generateIdMock,
	generateQrCodeMock,
	loadCheckInAdminHandlers,
} from '../helpers/checkin-admin.unit-helper';

describe('checkIn handler', () => {
	let adminMock: CheckInAdminMock;

	beforeEach(() => {
		adminMock = createCheckInAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		generateQrCodeMock.mockResolvedValue(undefined);
		generateIdMock.mockReturnValue('ZXCV2345');
	});

	it('rejects non-admin callers', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);

		expect(() =>
			checkIn(
				createCallableRequest(createRegistration(), { admin: false }),
			),
		).toThrowError();
	});

	it('creates a check-in record and returns the child count', async () => {
		const { checkIn } = await loadCheckInAdminHandlers(adminMock);
		const checkinDoc = adminMock.getDocRef('checkins/test-user-123');
		checkinDoc.create.mockResolvedValue(undefined);

		const result = await checkIn(
			createCallableRequest(createRegistration(), { admin: true }),
		);

		expect(result).toBe(1);
		expect(checkinDoc.create).toHaveBeenCalledTimes(1);
	});
});
