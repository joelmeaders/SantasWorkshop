import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearAllData,
	seedPublicParameters,
	seedTestScenario,
} from '../../src/fn/testHelpers';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getAdminApp,
	getAuth,
	getDocument,
	getFirestore,
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

	it('clears nested and unlisted emulator data', async () => {
		await setDocument('unlistedCollection', 'root', { value: true });
		await getFirestore()
			.doc('registrations/nested-user/mutationReceipts/receipt-1')
			.set({ operation: 'test' });
		await getFirestore()
			.doc('emailTemplates/confirmation/revisions/revision-1')
			.set({ fieldMappings: [] });
		await getFirestore()
			.doc('unlistedCollection/root/nestedDocuments/child-1')
			.set({ value: true });
		await getAuth().createUser({
			uid: 'auth-cleanup-1',
			email: 'auth-cleanup-1@example.com',
		});
		await getAdminApp()
			.storage()
			.bucket()
			.file('unlisted/cleanup.txt')
			.save('cleanup');

		await clearEmulatorData();

		expect(
			await getDocument<Record<string, unknown>>(
				'unlistedCollection',
				'root',
			),
		).toBeUndefined();
		expect(
			await getFirestore()
				.doc('registrations/nested-user/mutationReceipts/receipt-1')
				.get(),
		).toMatchObject({ exists: false });
		expect(
			await getFirestore()
				.doc('emailTemplates/confirmation/revisions/revision-1')
				.get(),
		).toMatchObject({ exists: false });
		expect(
			await getFirestore()
				.doc('unlistedCollection/root/nestedDocuments/child-1')
				.get(),
		).toMatchObject({ exists: false });
		await expect(getAuth().getUser('auth-cleanup-1')).rejects.toMatchObject(
			{
				code: 'auth/user-not-found',
			},
		);
		expect(
			(
				await getAdminApp()
					.storage()
					.bucket()
					.file('unlisted/cleanup.txt')
					.exists()
			)[0],
		).toBe(false);
	});

	it('refuses cleanup when an emulator endpoint is not configured', async () => {
		const originalFirestoreHost = process.env['FIRESTORE_EMULATOR_HOST'];
		delete process.env['FIRESTORE_EMULATOR_HOST'];

		try {
			await expect(clearEmulatorData()).rejects.toThrow(
				'require Firestore, Auth, and Storage emulators',
			);
		} finally {
			process.env['FIRESTORE_EMULATOR_HOST'] = originalFirestoreHost;
		}
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
