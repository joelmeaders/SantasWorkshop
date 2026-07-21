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

describe('checkInWithEdit handler', () => {
	let adminMock: CheckInAdminMock;

	beforeEach(() => {
		adminMock = createCheckInAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		generateQrCodeMock.mockResolvedValue(undefined);
		generateIdMock.mockReturnValue('ZXCV2345');
	});

	it('creates edited registration and check-in records', async () => {
		const { checkInWithEdit } = await loadCheckInAdminHandlers(adminMock);

		const result = await checkInWithEdit(
			createCallableRequest(createRegistration(), { admin: true }),
		);

		expect(result).toBe(1);
		expect(adminMock.batchCreate).toHaveBeenCalledTimes(2);
		expect(adminMock.doc).toHaveBeenCalledWith(
			'editedregistrations/test-user-123',
		);
	});
});
