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
				createCallableRequest(validPayload(), { roles: [] }),
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
					{ roles: ['admin', 'checkin'] },
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
					{ roles: ['admin', 'checkin'] },
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
				{ roles: ['admin', 'checkin'] },
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
					{ roles: ['admin', 'checkin'] },
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
				{ owner: true },
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
				{ owner: true },
			),
		);

		expect(adminMock.setCustomUserClaims).toHaveBeenCalledWith('staff-1', {
			roles: ['admin', 'checkin'],

		});
	});

	it('assigns only the selected check-in role', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await callableCreateStaffUser(
			createCallableRequest(validPayload(), { roles: ['admin', 'checkin'] }),
		);

		expect(adminMock.setCustomUserClaims).toHaveBeenCalledWith('staff-1', {
			roles: ['checkin'],

		});
	});

	it('rejects short passwords', async () => {
		const { callableCreateStaffUser } =
			await loadStaffAdminHandlers(adminMock);

		await expect(
			callableCreateStaffUser(
				createCallableRequest(
					{ ...validPayload(), password: 'short' },
					{ roles: ['admin', 'checkin'] },
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
					{ roles: ['admin', 'checkin'] },
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
				createCallableRequest(validPayload(), { roles: ['admin', 'checkin'] }),
			),
		).rejects.toMatchObject({ code: 'internal' });
		expect(adminMock.deleteUser).toHaveBeenCalledWith('staff-1');
	});
});
