import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	createAccountAdminMock,
	type AccountAdminMock,
	loadAccountRegistrationHandlers,
} from '../helpers/account-registration.unit-helper';

describe('updateEmailAddress handler', () => {
	let adminMock: AccountAdminMock;

	beforeEach(() => {
		adminMock = createAccountAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		adminMock.updateUser.mockResolvedValue(undefined);
		const firestore = adminMock.module.firestore();
		const auth = adminMock.module.auth();
		auth.getUser = vi
			.fn()
			.mockResolvedValue({ email: 'old.email@example.com' });
		const batch = firestore.batch();
		batch.update = vi.fn();
		firestore.getAll = vi.fn(
			async (...refs: { get: () => Promise<unknown> }[]) =>
				Promise.all(refs.map((ref) => ref.get())),
		);
		adminMock.module.firestore.mockReturnValue(firestore);
		adminMock.module.auth.mockReturnValue(auth);
		for (const path of [
			'users/user-6/emailChanges/state',
			'users/user-6/emailChanges/unit-email-change',
		]) {
			adminMock.setDocSnapshot(path, undefined as never, false);
		}
		for (const path of [
			'registrations/user-6',
			COLLECTION_SCHEMA.registrationSearchIndex + '/user-6',
		])
			adminMock.setDocSnapshot(path, {
				emailAddress: 'old.email@example.com',
			});
		adminMock.transactionSet.mockImplementation(
			(ref: { path: string }, data: Record<string, unknown>) =>
				adminMock.setDocSnapshot(ref.path, data),
		);
	});

	it('updates auth and all related documents', async () => {
		const { updateEmailAddress } =
			await loadAccountRegistrationHandlers(adminMock);

		const result = await updateEmailAddress(
			createCallableRequest(
				{
					emailAddress: 'new.email@example.com',
					mutationId: 'unit-email-change',
					expectedEmailAddress: 'old.email@example.com',
				},
				{
					uid: 'user-6',
					email: 'old.email@example.com',
				},
			),
		);

		expect(result).toBe(true);
		expect(adminMock.updateUser).toHaveBeenCalledWith('user-6', {
			email: 'new.email@example.com',
		});
		expect(adminMock.batchSet).toHaveBeenCalledOnce();
		expect(
			adminMock.module.firestore().batch().update,
		).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'registrations/user-6' }),
			{ emailAddress: 'new.email@example.com' },
		);
	});

	it.each([
		undefined,
		null,
		'123',
		NaN,
		Infinity,
		-Infinity,
		0,
		Date.now() / 1000 + 600,
	])(
		'rejects invalid or stale authentication time %s before any write',
		async (authTime) => {
			const { updateEmailAddress } =
				await loadAccountRegistrationHandlers(adminMock);
			const request = createCallableRequest(
				{
					emailAddress: 'new.email@example.com',
					auth_time: Date.now() / 1000,
					password: 'ignored',
				},
				{ uid: 'staff-1', roles: ['admin'], owner: true },
			);
			Object.assign(request.auth!.token, { auth_time: authTime });
			await expect(updateEmailAddress(request)).rejects.toMatchObject({
				code: 'failed-precondition',
			});
			expect(adminMock.updateUser).not.toHaveBeenCalled();
			expect(adminMock.batchSet).not.toHaveBeenCalled();
			expect(adminMock.batchCommit).not.toHaveBeenCalled();
		},
	);

	it('throws an HttpsError when the user is missing from context', async () => {
		const { updateEmailAddress } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			updateEmailAddress(
				{ emailAddress: 'new.email@example.com' },
				{} as never,
			),
		).rejects.toMatchObject({ code: 'unauthenticated' });
	});

	it('rejects invalid email addresses', async () => {
		const { updateEmailAddress } =
			await loadAccountRegistrationHandlers(adminMock);

		await expect(
			updateEmailAddress(
				createCallableRequest(
					{
						emailAddress: 'nope',
						mutationId: 'invalid-email-test',
						expectedEmailAddress: 'old.email@example.com',
					},
					{ uid: 'user-6', email: 'old.email@example.com' },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});
});
