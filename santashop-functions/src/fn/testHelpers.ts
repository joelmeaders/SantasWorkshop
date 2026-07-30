/**
 * Test helper functions for E2E testing
 * These functions should only be available in emulator mode
 */

import admin from '../firebase-admin';

export interface TestAdminUserSeed {
	uid?: string;
	emailAddress: string;
	password: string;
	admin?: boolean;
}

export interface TestDateTimeSlotSeed {
	id?: string;
	programYear: number;
	dateTime: string;
	maxSlots: number;
	slotsReserved?: number;
	enabled?: boolean;
	lastUpdated?: string;
}

export interface TestPublicParameters {
	registrationEnabled?: boolean;
	maintenanceModeEnabled?: boolean;
	weatherModeEnabled?: boolean;
	createAccountEnabled?: boolean;
	messageEn?: string;
	messageEs?: string;
	admin?: {
		checkinEnabled?: boolean;
		onsiteRegistrationEnabled?: boolean;
		preRegistrationEnabled?: boolean;
		allowCancelRegistration?: boolean;
		allowChangeRegistration?: boolean;
	};
	globalAlert?: {
		displayAlert?: boolean;
		titleEn?: string;
		titleEs?: string;
		messageEn?: string;
		messageEs?: string;
	};
}

/**
 * Seeds the Firestore database with public parameters for testing
 * @param params - The parameters to seed
 */
export async function seedPublicParameters(
	params: TestPublicParameters,
): Promise<void> {
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
		'checkins',
		'users',
		'registrations',
		'editedregistrations',
		'onsiteregistrations',
		'children',
		'dateTimeSlots',
		'emailTemplates',
		'registrationsearchindex',
		'stats',
		'tmp_registrationemails',
		'tmp_registrationemails2',
		'parameters',
		'staff',
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
 * Seeds an admin user in the Auth emulator.
 */
export async function seedAdminUser(
	user: TestAdminUserSeed,
): Promise<{ uid: string }> {
	const auth = admin.auth();
	const emailAddress = user.emailAddress.toLowerCase();

	try {
		const existingUser = await auth.getUserByEmail(emailAddress);
		await auth.deleteUser(existingUser.uid);
	} catch (error: unknown) {
		const code = (error as { code?: string }).code;

		if (code !== 'auth/user-not-found') {
			throw error;
		}
	}

	if (user.uid) {
		try {
			await auth.deleteUser(user.uid);
		} catch (error: unknown) {
			const code = (error as { code?: string }).code;

			if (code !== 'auth/user-not-found') {
				throw error;
			}
		}
	}

	const createdUser = await auth.createUser({
		uid: user.uid,
		email: emailAddress,
		password: user.password,
		emailVerified: true,
	});

	await auth.setCustomUserClaims(createdUser.uid, {
		admin: user.admin ?? true,
	});

	return { uid: createdUser.uid };
}

/**
 * Seeds date/time slots in Firestore for schedule-editor testing.
 */
export async function seedDateTimeSlots(
	slots: TestDateTimeSlotSeed[],
): Promise<{ ids: string[] }> {
	const db = admin.firestore();
	const ids: string[] = [];

	for (const slot of slots) {
		const docRef = slot.id
			? db.collection('dateTimeSlots').doc(slot.id)
			: db.collection('dateTimeSlots').doc();

		await docRef.set({
			programYear: slot.programYear,
			dateTime: new Date(slot.dateTime),
			maxSlots: slot.maxSlots,
			slotsReserved: slot.slotsReserved ?? 0,
			enabled: slot.enabled ?? true,
			lastUpdated: slot.lastUpdated
				? new Date(slot.lastUpdated)
				: new Date(),
		});

		ids.push(docRef.id);
	}

	return { ids };
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
			// Reuse the standard enabled scenario.
			await seedTestScenario('create-account-enabled');
	}
}
