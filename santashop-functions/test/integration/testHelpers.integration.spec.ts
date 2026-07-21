import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearAllData,
	seedPublicParameters,
	seedTestScenario,
} from '../../src/fn/testHelpers';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getAuth,
	getDocument,
	seedAuthUser,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('testHelpers integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('seeds public parameters in the emulator', async () => {
		await seedPublicParameters({
			registrationEnabled: false,
			messageEn: 'Testing',
		});

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.parameters,
				'public',
			),
		).toMatchObject({
			registrationEnabled: false,
			messageEn: 'Testing',
			admin: expect.objectContaining({ checkinEnabled: true }),
		});
	});

	it('clears seeded firestore data and auth users', async () => {
		await setDocument(COLLECTION_SCHEMA.users, 'user-1', {
			firstName: 'Buddy',
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-1', {
			uid: 'user-1',
		});
		await seedAuthUser({ uid: 'auth-1', email: 'auth-1@example.com' });

		await clearAllData();

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.users,
				'user-1',
			),
		).toBeUndefined();
		await expect(getAuth().getUser('auth-1')).rejects.toMatchObject({
			code: 'auth/user-not-found',
		});
	});

	it('seeds named scenarios with the expected flags', async () => {
		await seedTestScenario('maintenance-mode');

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.parameters,
				'public',
			),
		).toMatchObject({
			registrationEnabled: true,
			createAccountEnabled: true,
			maintenanceModeEnabled: true,
			weatherModeEnabled: false,
		});
	});
});
