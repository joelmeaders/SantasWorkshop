import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('undoRegistration handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
	});

	it('records an authorized cancellation and resets registration state', async () => {
		const { undoRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/user-4', {
			uid: 'user-4',
			qrcode: 'ABCD2345',
			qrCodeStoragePath: 'registrations/user-4/original.png',
			dateTimeSlot: {
				id: 'slot-1',
				dateTime: '2025-12-10T18:00:00.000Z',
			},
			registrationSubmittedOn: new Date('2025-12-01T00:00:00.000Z'),
			includedInCounts: true,
		});
		adminMock.setDocSnapshot('parameters/public', {
			admin: { allowCancelRegistration: true },
		});
		adminMock.setDocSnapshot(
			'registrations/user-4/mutationReceipts/cancel-user-0001',
			{},
			false,
		);

		const result = await undoRegistration(
			createCallableRequest(
				{ mutationId: 'cancel-user-0001' },
				{ uid: 'user-4' },
			),
		);

		expect(result).toBe(true);
		expect(adminMock.transactionDelete).toHaveBeenCalledTimes(2);
		expect(adminMock.transactionCreate).toHaveBeenCalledTimes(1);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
		expect.objectContaining({ path: 'registrations/user-4' }),
			expect.objectContaining({
				includedInCounts: false,
				previousDateTimeSlot: {
					id: 'slot-1',
					dateTime: '2025-12-10T18:00:00.000Z',
				},
			}),
		);
	});

	it('treats an already-cancelled registration as a retry-safe success', async () => {
		const { undoRegistration } =
			await loadAccountRegistrationHandlers(adminMock);
		adminMock.setDocSnapshot('registrations/user-4', {
			uid: 'user-4',
			qrcode: 'NEWCODE1',
			firstName: 'Customer',
			emailAddress: 'customer@example.com',
			previousDateTimeSlot: { id: 'slot-1', dateTime: '2025-12-10T18:00:00.000Z' },
			cancelledOn: new Date('2025-12-01T00:00:00.000Z'),
			cancellationLogId: 'cancel-log-1',
			qrCodeStoragePath: 'registrations/user-4/replacement.png',
		});
		adminMock.setDocSnapshot('parameters/public', {
			admin: { allowCancelRegistration: true },
		});
		adminMock.setDocSnapshot(
			'registrations/user-4/mutationReceipts/cancel-user-0001',
			{ operation: 'undoRegistration', result: true },
		);
		adminMock.setDocSnapshot('cancellations/cancel-log-1', {
			uid: 'user-4',
			actorUid: 'user-4',
			cancelledOn: new Date('2025-12-01T00:00:00.000Z'),
			programYear: 2025,
			supersededConfirmationCode: 'ABCD2345',
			supersededQrCodeStoragePath: 'registrations/user-4/original.png',
			replacementConfirmationCode: 'NEWCODE1',
			replacementQrCodeStoragePath: 'registrations/user-4/replacement.png',
		});

		await expect(
			undoRegistration(
				createCallableRequest(
					{ mutationId: 'cancel-user-0001' },
					{ uid: 'user-4' },
				),
			),
		).resolves.toBe(true);
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.transactionCreate).not.toHaveBeenCalled();
	});

	it('requires staff to cancel another account and rejects unavailable cancellations', async () => {
		const { undoRegistration } = await loadAccountRegistrationHandlers(adminMock);
		await expect(
			undoRegistration(
				createCallableRequest(
					{ mutationId: 'cancel-user-0001', uid: 'customer-2' },
					{ uid: 'user-4' },
				),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });

		adminMock.setDocSnapshot('registrations/user-4', {
			uid: 'user-4', registrationSubmittedOn: new Date(), qrcode: 'ABCD2345', qrCodeStoragePath: 'registrations/user-4/qr.png',
		});
		adminMock.setDocSnapshot('parameters/public', { admin: { allowCancelRegistration: false } });
		adminMock.setDocSnapshot('registrations/user-4/mutationReceipts/cancel-user-0001', {}, false);
		await expect(
			undoRegistration(createCallableRequest({ mutationId: 'cancel-user-0001' }, { uid: 'user-4' })),
		).rejects.toMatchObject({ code: 'failed-precondition' });
	});

	it('rejects registrations that are missing, unsubmitted, checked in, or lack QR details', async () => {
		const { undoRegistration } = await loadAccountRegistrationHandlers(adminMock);
		const request = () => createCallableRequest({ mutationId: 'cancel-user-0001' }, { uid: 'user-4' });
		adminMock.setDocSnapshot('parameters/public', { admin: { allowCancelRegistration: true } });
		adminMock.setDocSnapshot('registrations/user-4/mutationReceipts/cancel-user-0001', {}, false);
		adminMock.getDocRef('registrations/user-4').get.mockResolvedValue({
			exists: false,
			data: () => undefined,
		});
		await expect(undoRegistration(request())).rejects.toMatchObject({ code: 'not-found' });
		adminMock.setDocSnapshot('registrations/user-4', { uid: 'user-4' });
		await expect(undoRegistration(request())).rejects.toMatchObject({ code: 'failed-precondition' });
		adminMock.setDocSnapshot('registrations/user-4', { uid: 'user-4', registrationSubmittedOn: new Date(), hasCheckedIn: true });
		await expect(undoRegistration(request())).rejects.toMatchObject({ code: 'failed-precondition' });
		adminMock.setDocSnapshot('registrations/user-4', { uid: 'user-4', registrationSubmittedOn: new Date() });
		await expect(undoRegistration(request())).rejects.toMatchObject({ code: 'failed-precondition' });
	});

	it('refuses a retry-safe cancellation when its immutable cancellation log is unavailable', async () => {
		const { undoRegistration } = await loadAccountRegistrationHandlers(adminMock);
		adminMock.setDocSnapshot('parameters/public', { admin: { allowCancelRegistration: true } });
		adminMock.setDocSnapshot('registrations/user-4/mutationReceipts/cancel-user-0001', { operation: 'undoRegistration', result: true });
		adminMock.setDocSnapshot('registrations/user-4', {
			uid: 'user-4', cancelledOn: new Date(), cancellationLogId: 'missing-log', qrcode: 'ABCD2345', qrCodeStoragePath: 'registrations/user-4/qr.png',
		});
		await expect(
			undoRegistration(createCallableRequest({ mutationId: 'cancel-user-0001' }, { uid: 'user-4' })),
		).rejects.toMatchObject({ code: 'internal' });
	});
});
