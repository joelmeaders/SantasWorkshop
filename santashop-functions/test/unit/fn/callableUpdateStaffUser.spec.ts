import { beforeEach, describe, expect, it } from 'vitest';
import type { UpdateStaffUser } from '@santashop/models';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createStaffAdminMock,
	loadStaffAdminHandlers,
	type StaffAdminMock,
} from '../helpers/staff-admin.unit-helper';

const PROTECTED_UID = 'bIMHv99EssTqMfhX2kkYm2vErwu1';

describe('callableUpdateStaffUser handler', () => {
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
	});

	it('rejects non-admin callers', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableUpdateStaffUser(
				createCallableRequest<UpdateStaffUser>(
					{ uid: 'staff-1', displayName: 'New Name' },
					{ admin: false },
				),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('rejects a missing uid', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableUpdateStaffUser(
				createCallableRequest<UpdateStaffUser>(
					{ uid: '' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects updates for non-staff targets', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableUpdateStaffUser(
				createCallableRequest<UpdateStaffUser>(
					{ uid: 'customer-123', displayName: 'Nope' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'not-found' });
	});

	it('updates display name, password, and disabled state via updateUser', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableUpdateStaffUser(
			createCallableRequest<UpdateStaffUser>(
				{
					uid: 'staff-1',
					displayName: 'New Name',
					newPassword: 'BrandNew123!',
					disabled: true,
				},
				{ admin: true },
			),
		);

		expect(adminMock.updateUser).toHaveBeenCalledWith('staff-1', {
			displayName: 'New Name',
			password: 'BrandNew123!',
			disabled: true,
		});
		expect(adminMock.getDocRef('staff/staff-1').set).toHaveBeenCalledWith(
			expect.objectContaining({
				displayName: 'New Name',
				disabled: true,
			}),
			{ merge: true },
		);
	});

	it('updates claims when roles are provided', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableUpdateStaffUser(
			createCallableRequest<UpdateStaffUser>(
				{ uid: 'staff-1', roles: ['admin', 'checkin'] },
				{ owner: true },
			),
		);

		expect(adminMock.setCustomUserClaims).toHaveBeenCalledWith('staff-1', {
			roles: ['admin', 'checkin'],
			admin: true,
		});
	});

	it('normalizes admin-only role updates to include checkin', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableUpdateStaffUser(
			createCallableRequest<UpdateStaffUser>(
				{ uid: 'staff-1', roles: ['admin'] },
				{ owner: true },
			),
		);

		expect(adminMock.setCustomUserClaims).toHaveBeenCalledWith('staff-1', {
			roles: ['admin', 'checkin'],
			admin: true,
		});
	});

	it('does not call updateUser when only roles change', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableUpdateStaffUser(
			createCallableRequest<UpdateStaffUser>(
				{ uid: 'staff-1', roles: ['checkin'] },
				{ admin: true },
			),
		);

		expect(adminMock.updateUser).not.toHaveBeenCalled();
	});

	it('blocks removing admin rights from a protected account', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableUpdateStaffUser(
				createCallableRequest<UpdateStaffUser>(
					{ uid: PROTECTED_UID, roles: ['checkin'] },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
		expect(adminMock.setCustomUserClaims).not.toHaveBeenCalled();
	});

	it('rejects an empty roles list', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableUpdateStaffUser(
				createCallableRequest<UpdateStaffUser>(
					{ uid: 'staff-1', roles: [] },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects short password updates', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableUpdateStaffUser(
				createCallableRequest<UpdateStaffUser>(
					{ uid: 'staff-1', newPassword: 'short' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects blank display names after trimming', async () => {
		const { callableUpdateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableUpdateStaffUser(
				createCallableRequest<UpdateStaffUser>(
					{ uid: 'staff-1', displayName: '  ' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});
});
