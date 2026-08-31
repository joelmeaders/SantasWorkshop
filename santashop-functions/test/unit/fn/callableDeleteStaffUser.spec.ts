import { beforeEach, describe, expect, it } from 'vitest';
import type { DeleteStaffUser } from '@santashop/models';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createStaffAdminMock,
	loadStaffAdminHandlers,
	type StaffAdminMock,
} from '../helpers/staff-admin.unit-helper';

const PROTECTED_UID = 'bIMHv99EssTqMfhX2kkYm2vErwu1';

describe('callableDeleteStaffUser handler', () => {
	let adminMock: StaffAdminMock;

	beforeEach(() => {
		adminMock = createStaffAdminMock();
		adminMock.setDocSnapshot('staff/staff-1', {
			uid: 'staff-1',
			displayName: 'Staff Member',
			emailAddress: 'staff@example.com',
			roles: ['checkin'],
			disabled: false,
		});
		adminMock.setDocSnapshot(`staff/${PROTECTED_UID}`, {
			uid: PROTECTED_UID,
			displayName: 'Protected Admin',
			emailAddress: 'protected@example.com',
			roles: ['admin', 'checkin'],
			disabled: false,
		});
		adminMock.setUserClaims(PROTECTED_UID, {
			owner: true,
			admin: true,
			roles: ['admin', 'checkin'],
		});
		adminMock.setDocSnapshot('staff/test-user-123', {
			uid: 'test-user-123',
			displayName: 'Self User',
			emailAddress: 'self@example.com',
			roles: ['checkin'],
			disabled: false,
		});
	});

	it('rejects non-admin callers', async () => {
		const { callableDeleteStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableDeleteStaffUser(
				createCallableRequest<DeleteStaffUser>(
					{ uid: 'staff-1' },
					{ admin: false },
				),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('rejects a missing uid', async () => {
		const { callableDeleteStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableDeleteStaffUser(
				createCallableRequest<DeleteStaffUser>(
					{ uid: '' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('blocks deleting a protected account', async () => {
		const { callableDeleteStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableDeleteStaffUser(
				createCallableRequest<DeleteStaffUser>(
					{ uid: PROTECTED_UID },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		expect(adminMock.deleteUser).not.toHaveBeenCalled();
	});

	it('rejects deleting non-staff targets', async () => {
		const { callableDeleteStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableDeleteStaffUser(
				createCallableRequest<DeleteStaffUser>(
					{ uid: 'customer-123' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'not-found' });
	});

	it('blocks deleting your own account', async () => {
		const { callableDeleteStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableDeleteStaffUser(
				createCallableRequest<DeleteStaffUser>(
					{ uid: 'test-user-123' },
					{ uid: 'test-user-123', admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		expect(adminMock.deleteUser).not.toHaveBeenCalled();
	});

	it('deletes the auth user and the staff doc on success', async () => {
		const { callableDeleteStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableDeleteStaffUser(
			createCallableRequest<DeleteStaffUser>(
				{ uid: 'staff-1' },
				{ admin: true },
			),
		);

		expect(adminMock.deleteUser).toHaveBeenCalledWith('staff-1');
		expect(adminMock.getDocRef('staff/staff-1').delete).toHaveBeenCalled();
	});
});
