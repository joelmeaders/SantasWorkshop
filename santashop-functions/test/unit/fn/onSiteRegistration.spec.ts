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

describe('onSiteRegistration handler', () => {
	let adminMock: CheckInAdminMock;

	beforeEach(() => {
		adminMock = createCheckInAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		generateQrCodeMock.mockResolvedValue(undefined);
		generateIdMock.mockReturnValue('ZXCV2345');
	});

	it('creates an onsite registration and check-in using a generated id', async () => {
		const { onSiteRegistration } =
			await loadCheckInAdminHandlers(adminMock);

		const result = await onSiteRegistration(
			createCallableRequest(
				createRegistration({ uid: 'ignored-input' }),
				{
					admin: true,
				},
			),
		);

		expect(result).toBe(1);
		expect(adminMock.batchCreate).toHaveBeenCalledTimes(2);
		expect(adminMock.collection).toHaveBeenCalledWith(
			'onsiteregistrations',
		);
		expect(adminMock.doc).toHaveBeenCalledWith(
			'onsiteregistrations/generated-onsite-id',
		);
	});
});
