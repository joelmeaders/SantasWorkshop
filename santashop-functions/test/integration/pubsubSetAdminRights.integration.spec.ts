import { beforeEach, describe, expect, it } from 'vitest';
import pubsubSetAdminRights from '../../src/fn/pubsubSetAdminRights';
import {
	getAuth,
	clearEmulatorData,
	seedAuthUser,
} from '../helpers/admin-emulator';

describe.sequential('pubsubSetAdminRights integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('assigns admin claims to the configured users', async () => {
		const adminUids = [
			'bIMHv99EssTqMfhX2kkYm2vErwu1',
			'xkeLDNPTVVPkt6Onh4EGYNuGi2C2',
			'sGVW9Om1E5UGKWcq97EpygbwQfl2',
			'2kNkKB4Xz5agjs6TfXzQStJ38gx1',
			'RDkrgjJE0oQAXY6peLoABJvOH2j2',
		];

		for (const uid of adminUids) {
			await seedAuthUser({ uid, email: `${uid}@example.com` });
		}

		await pubsubSetAdminRights();

		const updatedUser = await getAuth().getUser(adminUids[0]);
		expect(updatedUser.customClaims).toMatchObject({ admin: true });
		expect(updatedUser.disabled).toBe(false);
	});
});
