import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStaffUser } from '@santashop/models';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createStaffAdminMock,
	loadStaffAdminHandlers,
	type StaffAdminMock,
} from '../helpers/staff-admin.unit-helper';

const validPayload = (): CreateStaffUser => ({
	emailAddress: 'staff@example.com',
	displayName: 'Staff Member',
	password: 'Password123!',
	roles: ['checkin'],
});

describe('callableCreateStaffUser handler', () => {
	let adminMock: StaffAdminMock;

	beforeEach(() => {
		adminMock = createStaffAdminMock();
		adminMock.createUser.mockResolvedValue({ uid: 'staff-1' });
	});

	it('rejects non-admin callers', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableCreateStaffUser(
				createCallableRequest(validPayload(), { admin: false }),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('rejects missing required fields', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableCreateStaffUser(
				createCallableRequest(
					{ ...validPayload(), emailAddress: '' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects invalid email addresses', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableCreateStaffUser(
				createCallableRequest(
					{ ...validPayload(), emailAddress: 'not-an-email' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('trims valid email addresses before creating auth users', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableCreateStaffUser(
			createCallableRequest(
				{ ...validPayload(), emailAddress: '  STAFF@EXAMPLE.COM  ' },
				{ admin: true },
			),
		);

		expect(adminMock.createUser).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'staff@example.com',
			}),
		);
	});

	it('rejects an empty roles list', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableCreateStaffUser(
				createCallableRequest(
					{ ...validPayload(), roles: [] },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('creates the user, sets claims, writes the staff doc, and returns the uid', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		const result = await callableCreateStaffUser(
			createCallableRequest(
				{ ...validPayload(), roles: ['checkin', 'admin'] },
				{ admin: true },
			),
		);

		expect(result).toBe('staff-1');
		expect(adminMock.createUser).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'staff@example.com',
				displayName: 'Staff Member',
				password: 'Password123!',
				disabled: false,
			}),
		);
		expect(adminMock.setCustomUserClaims).toHaveBeenCalledWith('staff-1', {
			roles: ['checkin', 'admin'],
			admin: true,
		});
		expect(adminMock.getDocRef('staff/staff-1').set).toHaveBeenCalledWith(
			expect.objectContaining({
				uid: 'staff-1',
				emailAddress: 'staff@example.com',
				displayName: 'Staff Member',
				roles: ['checkin', 'admin'],
				disabled: false,
			}),
		);
	});

	it('normalizes admin-only role selections to also include checkin', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableCreateStaffUser(
			createCallableRequest(
				{ ...validPayload(), roles: ['admin'] },
				{ admin: true },
			),
		);

		expect(adminMock.setCustomUserClaims).toHaveBeenCalledWith('staff-1', {
			roles: ['admin', 'checkin'],
			admin: true,
		});
	});

	it('sets admin false when only checkin is assigned', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableCreateStaffUser(
			createCallableRequest(validPayload(), { admin: true }),
		);

		expect(adminMock.setCustomUserClaims).toHaveBeenCalledWith('staff-1', {
			roles: ['checkin'],
			admin: false,
		});
	});

	it('rejects short passwords', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableCreateStaffUser(
				createCallableRequest(
					{ ...validPayload(), password: 'short' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects blank display names after trimming', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableCreateStaffUser(
				createCallableRequest(
					{ ...validPayload(), displayName: '  ' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rolls back the auth user when persisting the staff doc fails', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);
		adminMock
			.getDocRef('staff/staff-1')
			.set.mockRejectedValue(new Error('firestore failed'));

		await expect(
			callableCreateStaffUser(
				createCallableRequest(validPayload(), { admin: true }),
			),
		).rejects.toMatchObject({ code: 'internal' });
		expect(adminMock.deleteUser).toHaveBeenCalledWith('staff-1');
	});
});
