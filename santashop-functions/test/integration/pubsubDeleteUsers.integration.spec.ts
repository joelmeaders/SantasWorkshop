import { beforeEach, describe, expect, it } from 'vitest';
import pubsubDeleteUsers from '../../src/fn/pubsubDeleteUsers';
import {
	clearEmulatorData,
	getAuth,
	seedAuthUser,
} from '../helpers/admin-emulator';

describe.sequential('pubsubDeleteUsers integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('deletes enabled users while keeping disabled accounts', async () => {
		await seedAuthUser({
			uid: 'enabled-user',
			email: 'enabled@example.com',
		});
		await seedAuthUser({
			uid: 'disabled-user',
			email: 'disabled@example.com',
			disabled: true,
		});

		await pubsubDeleteUsers();

		await expect(getAuth().getUser('enabled-user')).rejects.toMatchObject({
			code: 'auth/user-not-found',
		});
		const disabledUser = await getAuth().getUser('disabled-user');
		expect(disabledUser.disabled).toBe(true);
	});
});
