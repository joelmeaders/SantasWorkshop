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
	owner?: boolean;
	roles?: Array<'admin' | 'checkin'>;
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

export interface TestRegistrationSearchIndexSeed {
	id?: string;
	firstName: string;
	lastName: string;
	emailAddress: string;
	customerId: string;
	zip: string;
	code?: string;
}

export interface TestScheduleStatsSeed {
	programYear: number;
	dateTimeCounts: Array<{ dateTime: string; count: number }>;
}

export interface TestRegistrationStatsSeed {
	programYear: number;
	completedRegistrations: number;
	dateTimeCount: Array<{
		dateTime: string;
		count: number;
		childCount: number;
		stats: {
			infants: Record<string, number>;
			girls: Record<string, number>;
			boys: Record<string, number>;
		};
	}>;
	zipCodeCount: Array<{ zip: number; count: number; childCount: number }>;
}

export interface TestCheckInStatsSeed {
	programYear: number;
	lastUpdated: string;
	dateTimeCount: Array<{
		date: number;
		hour: number;
		customerCount: number;
		childCount: number;
		pregisteredCount: number;
		modifiedCount: number;
	}>;
}

export interface TestUserStatsSeed {
	programYear: number;
	totalUsers: number;
	zipCodeCount: Array<{ zip: string; count: number }>;
	referrerCount: Array<{ referrer: string; count: number }>;
}

export interface TestRegistrationSeed {
	uid: string;
	firstName: string;
	lastName: string;
	emailAddress: string;
	zipCode: string;
	code: string;
	dateTime: string;
	children?: Array<{ firstName: string; lastName: string; dateOfBirth: string; ageGroup: string }>;
	hasCheckedIn?: boolean;
	qrReady?: boolean;
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
		'cancellations',
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
		owner: user.owner ?? false,
		roles:
			user.roles ??
			(user.owner || user.admin !== false ? ['admin', 'checkin'] : []),
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
		const dateTime = new Date(slot.dateTime);
		const lastUpdated = slot.lastUpdated
			? new Date(slot.lastUpdated)
			: new Date();

		if (Number.isNaN(dateTime.getTime())) {
			throw new Error(`Invalid dateTime for test slot ${docRef.id}.`);
		}
		if (Number.isNaN(lastUpdated.getTime())) {
			throw new Error(`Invalid lastUpdated for test slot ${docRef.id}.`);
		}

		await docRef.set({
			programYear: slot.programYear,
			dateTime,
			maxSlots: slot.maxSlots,
			slotsReserved: slot.slotsReserved ?? 0,
			enabled: slot.enabled ?? true,
			lastUpdated,
		});

		ids.push(docRef.id);
	}

	return { ids };
}

/**
 * Seeds submitted-registration lookup index documents for staff E2E tests.
 */
export async function seedRegistrationSearchIndex(
	records: TestRegistrationSearchIndexSeed[],
): Promise<{ ids: string[] }> {
	const db = admin.firestore();
	const ids: string[] = [];

	for (const record of records) {
		const docRef = record.id
			? db.collection('registrationsearchindex').doc(record.id)
			: db.collection('registrationsearchindex').doc();
		await docRef.set({
			firstName: record.firstName,
			lastName: record.lastName.toLowerCase(),
			displayFirstName: record.firstName,
			displayLastName: record.lastName,
			emailAddress: record.emailAddress.toLowerCase(),
			customerId: record.customerId,
			zip: record.zip,
			code: record.code?.toUpperCase(),
		});
		ids.push(docRef.id);
	}

	return { ids };
}

/** Seeds a complete customer registration and its lookup index for browser flows. */
export async function seedRegistration(
	seed: TestRegistrationSeed,
): Promise<void> {
	const dateTime = new Date(seed.dateTime);
	if (Number.isNaN(dateTime.getTime())) {
		throw new Error(`Invalid registration dateTime: ${seed.dateTime}.`);
	}
	const children = (seed.children ?? [
		{ firstName: 'Test', lastName: 'Child', dateOfBirth: '2018-01-01', ageGroup: '5-11' },
	]).map((child, index) => ({ ...child, id: index + 1, dateOfBirth: new Date(child.dateOfBirth) }));
	const db = admin.firestore();
	await db.collection('users').doc(seed.uid).set({
		firstName: seed.firstName,
		lastName: seed.lastName,
		emailAddress: seed.emailAddress.toLowerCase(),
		zipCode: seed.zipCode,
		acceptedTermsOfService: new Date(),
		acceptedPrivacyPolicy: new Date(),
		version: 1,
	});
	await db.collection('registrations').doc(seed.uid).set({
		uid: seed.uid,
		firstName: seed.firstName,
		lastName: seed.lastName,
		emailAddress: seed.emailAddress.toLowerCase(),
		zipCode: seed.zipCode,
		qrcode: seed.code.toUpperCase(),
		children,
		dateTimeSlot: { id: 'e2e-registration-slot', dateTime },
		registrationSubmittedOn: new Date(),
		includedInCounts: false,
		includedInRegistrationStats: false,
		programYear: 2026,
		hasCheckedIn: seed.hasCheckedIn ?? false,
		qrCodeGeneratedOn: seed.qrReady === false ? false : new Date(),
		qrCodeGenerationFailedOn: false,
	});
	if (seed.hasCheckedIn) {
		await db.collection('checkins').doc(seed.uid).set({
			checkInDateTime: new Date(),
			customerId: seed.uid,
			registrationCode: seed.code.toUpperCase(),
			inStats: false,
			stats: { children: children.length },
		});
	}
	await seedRegistrationSearchIndex([{
		id: seed.uid,
		firstName: seed.firstName.toLowerCase(),
		lastName: seed.lastName,
		emailAddress: seed.emailAddress,
		customerId: seed.uid,
		zip: seed.zipCode,
		code: seed.code,
	}]);
}

/** Seeds schedule statistics for data-backed reporting E2E cases. */
export async function seedScheduleStats(
	stats: TestScheduleStatsSeed,
): Promise<void> {
	if (!Number.isInteger(stats.programYear)) {
		throw new Error('programYear must be a whole number.');
	}

	const dateTimeCounts = stats.dateTimeCounts.map((entry) => {
		const dateTime = new Date(entry.dateTime);
		if (Number.isNaN(dateTime.getTime())) {
			throw new Error(`Invalid schedule-stat date: ${entry.dateTime}.`);
		}
		if (!Number.isInteger(entry.count) || entry.count < 0) {
			throw new Error('Schedule-stat counts must be non-negative integers.');
		}
		return { dateTime, count: entry.count };
	});

	await admin
		.firestore()
		.collection('stats')
		.doc(`schedule-${stats.programYear}`)
		.set({ dateTimeCounts });
}

/** Seeds the nightly registration statistics document used by reporting E2E cases. */
export async function seedRegistrationStats(
	stats: TestRegistrationStatsSeed,
): Promise<void> {
	const dateTimeCount = stats.dateTimeCount.map((entry) => ({
		...entry,
		dateTime: new Date(entry.dateTime),
	}));
	await admin
		.firestore()
		.collection('stats')
		.doc(`registration-${stats.programYear}`)
		.set({
			completedRegistrations: stats.completedRegistrations,
			dateTimeCount,
			zipCodeCount: stats.zipCodeCount,
		});
}

/** Seeds the aggregated check-in statistics document used by reporting E2E cases. */
export async function seedCheckInStats(
	stats: TestCheckInStatsSeed,
): Promise<void> {
	await admin
		.firestore()
		.collection('stats')
		.doc(`checkin-${stats.programYear}`)
		.set({
			lastUpdated: new Date(stats.lastUpdated),
			dateTimeCount: stats.dateTimeCount,
		});
}

/** Seeds the referral and ZIP statistics document used by reporting E2E cases. */
export async function seedUserStats(stats: TestUserStatsSeed): Promise<void> {
	await admin
		.firestore()
		.collection('stats')
		.doc(`user-${stats.programYear}`)
		.set({
			totalUsers: stats.totalUsers,
			zipCodeCount: stats.zipCodeCount,
			referrerCount: stats.referrerCount,
		});
}

/**
 * Marks an emulator customer registration as checked in for customer E2E tests.
 */
export async function seedCheckInForEmail(
	emailAddress: string,
): Promise<{ uid: string }> {
	const authUser = await admin.auth().getUserByEmail(emailAddress);
	const db = admin.firestore();

	await db.collection('checkins').doc(authUser.uid).set({
		checkInDateTime: new Date(),
		customerId: authUser.uid,
		inStats: false,
		registrationCode: 'E2E-CHECKIN',
	});
	await db
		.collection('registrations')
		.doc(authUser.uid)
		.set({ hasCheckedIn: true }, { merge: true });

	return { uid: authUser.uid };
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
