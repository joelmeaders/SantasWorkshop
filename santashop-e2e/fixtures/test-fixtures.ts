import { test as base } from '@playwright/test';

export interface E2eAdminSeedUser {
	uid?: string;
	emailAddress: string;
	password: string;
	admin?: boolean;
	owner?: boolean;
	roles?: Array<'admin' | 'checkin'>;
}

export interface E2eSeedDateTimeSlot {
	id?: string;
	programYear: number;
	dateTime: string;
	maxSlots: number;
	slotsReserved?: number;
	enabled?: boolean;
	lastUpdated?: string;
}

export interface E2eSeedRegistrationSearchIndex {
	id?: string;
	firstName: string;
	lastName: string;
	emailAddress: string;
	customerId: string;
	zip: string;
	code?: string;
}

export interface E2eSeedScheduleStats {
	programYear: number;
	dateTimeCounts: Array<{ dateTime: string; count: number }>;
}

export interface E2eSeedReportingStats {
	registration?: {
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
	};
	checkIn?: {
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
	};
	user?: {
		programYear: number;
		totalUsers: number;
		zipCodeCount: Array<{ zip: string; count: number }>;
		referrerCount: Array<{ referrer: string; count: number }>;
	};
}

export interface E2eSeedRegistration {
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

export interface E2ePublicParameters {
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
 * Custom fixtures for SantaShop E2E tests
 *
 * This file provides helpers for:
 * - Firebase emulator setup/teardown
 * - Test data seeding
 * - Database cleanup
 */

type CustomFixtures = {
	/** Helper to seed test scenarios in the Firebase emulator */
	seedScenario: (scenario: string) => Promise<void>;
	/** Helper to clear all data from Firebase emulator */
	clearData: () => Promise<void>;
	/** Helper to seed custom public parameters */
	seedPublicParams: (params: E2ePublicParameters) => Promise<void>;
	/** Helper to seed an admin auth user */
	seedAdminUser: (user: E2eAdminSeedUser) => Promise<{ uid: string }>;
	/** Helper to seed date/time slot documents */
	seedDateTimeSlots: (
		slots: E2eSeedDateTimeSlot[],
	) => Promise<{ ids: string[] }>;
	/** Helper to seed submitted-registration lookup index documents */
	seedRegistrationSearchIndex: (
		records: E2eSeedRegistrationSearchIndex[],
	) => Promise<{ ids: string[] }>;
	/** Helper to seed a current-season schedule-statistics document. */
	seedScheduleStats: (stats: E2eSeedScheduleStats) => Promise<void>;
	/** Helper to seed reporting statistics documents. */
	seedReportingStats: (stats: E2eSeedReportingStats) => Promise<void>;
	/** Helper to mark a seeded customer registration as checked in */
	seedCheckIn: (emailAddress: string) => Promise<{ uid: string }>;
	/** Seed a complete registration for staff operational flows. */
	seedRegistration: (registration: E2eSeedRegistration) => Promise<void>;
};

// Firebase Functions emulator URL.
// Defaults to the local emulator project (demo-santashop) used by
// `emulators:start:local` and the app's `local` build configuration, which
// connects the browser app to the emulators with App Check disabled.
const EMULATOR_PROJECT_ID =
	process.env['E2E_EMULATOR_PROJECT'] ?? 'demo-santashop';
const FUNCTIONS_EMULATOR_URL = `http://127.0.0.1:5001/${EMULATOR_PROJECT_ID}/us-central1`;

/**
 * Calls a Firebase function in the emulator
 */
async function callFunction(
	functionName: string,
	data?: any,
	attempt = 0,
): Promise<any> {
	const response = await fetch(`${FUNCTIONS_EMULATOR_URL}/${functionName}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ data: data || {} }),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		const functionDiscoveryPending =
			response.status === 404 &&
			errorBody.includes('does not exist') &&
			attempt < 30;

		if (functionDiscoveryPending) {
			await new Promise((resolve) => setTimeout(resolve, 500));
			return callFunction(functionName, data, attempt + 1);
		}

		throw new Error(
			`Function call failed: ${response.statusText} - ${errorBody}`,
		);
	}

	const result = (await response.json()) as { result: any };
	return result.result;
}

export const test = base.extend<CustomFixtures>({
	seedScenario: async ({}, use) => {
		const seedScenario = async (scenario: string) => {
			await callFunction('testSeedScenario', { scenario });
		};
		await use(seedScenario);
	},

	clearData: async ({}, use) => {
		const clearData = async () => {
			await callFunction('testClearAllData');
		};
		await use(clearData);
	},

	seedPublicParams: async ({}, use) => {
		const seedPublicParams = async (params: E2ePublicParameters) => {
			await callFunction('testSeedPublicParameters', params);
		};
		await use(seedPublicParams);
	},

	seedAdminUser: async ({}, use) => {
		const seedAdminUser = async (user: E2eAdminSeedUser) =>
			callFunction('testSeedAdminUser', user) as Promise<{ uid: string }>;
		await use(seedAdminUser);
	},

	seedDateTimeSlots: async ({}, use) => {
		const seedDateTimeSlots = async (slots: E2eSeedDateTimeSlot[]) =>
			callFunction('testSeedDateTimeSlots', {
				slots,
			}) as Promise<{ ids: string[] }>;
		await use(seedDateTimeSlots);
	},

	seedRegistrationSearchIndex: async ({}, use) => {
		const seedRegistrationSearchIndex = async (
			records: E2eSeedRegistrationSearchIndex[],
		) =>
			callFunction('testSeedRegistrationSearchIndex', {
				records,
			}) as Promise<{ ids: string[] }>;
		await use(seedRegistrationSearchIndex);
	},

	seedScheduleStats: async ({}, use) => {
		const seedScheduleStats = async (stats: E2eSeedScheduleStats) => {
			await callFunction('testSeedScheduleStats', stats);
		};
		await use(seedScheduleStats);
	},

	seedReportingStats: async ({}, use) => {
		const seedReportingStats = async (stats: E2eSeedReportingStats) => {
			await callFunction('testSeedReportingStats', stats);
		};
		await use(seedReportingStats);
	},

	seedCheckIn: async ({}, use) => {
		const seedCheckIn = async (emailAddress: string) =>
			callFunction('testSeedCheckIn', { emailAddress }) as Promise<{
				uid: string;
			}>;
		await use(seedCheckIn);
	},

	seedRegistration: async ({}, use) => {
		const seedRegistration = async (registration: E2eSeedRegistration) => {
			await callFunction('testSeedRegistration', registration);
		};
		await use(seedRegistration);
	},
});

export { expect } from '@playwright/test';
