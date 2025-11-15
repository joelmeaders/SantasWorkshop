/**
 * Test helper functions for E2E testing
 * These functions should only be available in emulator mode
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

/**
 * Seeds the Firestore database with public parameters for testing
 * @param params - The parameters to seed
 */
export async function seedPublicParameters(params: {
	registrationEnabled?: boolean;
	maintenanceModeEnabled?: boolean;
	weatherModeEnabled?: boolean;
	createAccountEnabled?: boolean;
	messageEn?: string;
	messageEs?: string;
}): Promise<void> {
	const db = admin.firestore();

	const defaultParams = {
		registrationEnabled: true,
		maintenanceModeEnabled: false,
		weatherModeEnabled: false,
		createAccountEnabled: true,
		messageEn: '',
		messageEs: '',
		admin: {
			checkinEnabled: true,
			onsiteRegistrationEnabled: true,
			preRegistrationEnabled: true,
			allowCancelRegistration: true,
			allowChangeRegistration: true,
		},
		globalAlert: {
			displayAlert: false,
			titleEn: '',
			titleEs: '',
			messageEn: '',
			messageEs: '',
		},
	};

	const mergedParams = { ...defaultParams, ...params };

	await db.collection('parameters').doc('public').set(mergedParams);
}

/**
 * Clears all data from Firestore, Auth, and Storage
 * WARNING: This will delete all data in the emulator
 */
export async function clearAllData(): Promise<void> {
	const db = admin.firestore();
	const auth = admin.auth();

	// Clear Firestore collections
	const collections = [
		'users',
		'registrations',
		'children',
		'dateTimeSlots',
		'parameters',
	];

	for (const collectionName of collections) {
		const snapshot = await db.collection(collectionName).get();
		const batch = db.batch();
		snapshot.docs.forEach((doc) => {
			batch.delete(doc.ref);
		});
		await batch.commit();
	}

	// Clear Auth users
	const listUsersResult = await auth.listUsers();
	const deletePromises = listUsersResult.users.map((user) =>
		auth.deleteUser(user.uid),
	);
	await Promise.all(deletePromises);

	// Note: Storage clearing would require additional setup
	// For now, we'll just clear Firestore and Auth
}

/**
 * Seeds a specific scenario for testing
 * @param scenario - The test scenario name
 */
export async function seedTestScenario(scenario: string): Promise<void> {
	switch (scenario) {
		case 'create-account-enabled':
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
			});
			break;

		case 'create-account-disabled':
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: false,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
			});
			break;

		case 'registration-closed':
			await seedPublicParameters({
				registrationEnabled: false,
				createAccountEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
			});
			break;

		case 'maintenance-mode':
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: true,
				maintenanceModeEnabled: true,
				weatherModeEnabled: false,
			});
			break;

		case 'weather-mode':
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: true,
			});
			break;

		default:
			// Default scenario - everything enabled
			await seedPublicParameters({
				registrationEnabled: true,
				createAccountEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
			});
	}
}
