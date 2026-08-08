/* eslint-disable no-empty-pattern -- Playwright fixture callbacks require object destructuring. */
import { test as base } from '@playwright/test';

export interface E2eAdminSeedUser {
	uid?: string;
	emailAddress: string;
	password: string;
	admin?: boolean;
	owner?: boolean;
	roles?: ('admin' | 'checkin')[];
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
	dateTimeCounts: { dateTime: string; count: number }[];
}

export interface E2eSeedReportingStats {
	registration?: {
		programYear: number;
		completedRegistrations: number;
		dateTimeCount: {
			dateTime: string;
			count: number;
			childCount: number;
			stats: {
				infants: Record<string, number>;
				girls: Record<string, number>;
				boys: Record<string, number>;
			};
		}[];
		zipCodeCount: { zip: number; count: number; childCount: number }[];
	};
	checkIn?: {
		programYear: number;
		lastUpdated: string;
		dateTimeCount: {
			date: number;
			hour: number;
			customerCount: number;
			childCount: number;
			pregisteredCount: number;
			modifiedCount: number;
		}[];
	};
	user?: {
		programYear: number;
		totalUsers: number;
		zipCodeCount: { zip: string; count: number }[];
		referrerCount: { referrer: string; count: number }[];
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
	children?: { firstName: string; lastName: string; dateOfBirth: string; ageGroup: string }[];
	hasCheckedIn?: boolean;
	checkInDateTime?: string;
	qrReady?: boolean;
	incomplete?: boolean;
	cancellation?: {
		supersededCode: string;
		cancelledOn?: string;
		reRegistered?: boolean;
	};
}

export interface E2eRegistrationQrLifecycle {
	uid: string;
	registration: {
		hasSubmittedRegistration: boolean;
		cancelled: boolean;
		dateTimeSlot?: { id?: string; dateTime?: string };
		previousDateTimeSlot?: { id?: string; dateTime?: string };
	};
	searchIndex: {
		exists: boolean;
		customerId?: string;
		code?: string;
		firstName?: string;
		lastName?: string;
		displayFirstName?: string;
		displayLastName?: string;
		emailAddress?: string;
		zip?: string;
	};
	slots: {
		current?: { id: string; maxSlots?: number; slotsReserved?: number; enabled?: boolean };
		previous?: { id: string; maxSlots?: number; slotsReserved?: number; enabled?: boolean };
	};
	current: {
		code?: string;
		path?: string;
		object: E2eStorageObjectInfo;
	};
	latestCancellation?: {
		supersededCode: string;
		supersededPath: string;
		replacementCode: string;
		replacementPath: string;
		supersededObject: E2eStorageObjectInfo;
		replacementObject: E2eStorageObjectInfo;
	};
	cancellationHistory: {
		supersededCode: string;
		supersededPath: string;
		replacementCode: string;
		replacementPath: string;
		cancelledOn: string;
	}[];
}

export interface E2eStorageObjectInfo {
	exists: boolean;
	md5Hash?: string;
	cacheControl?: string;
	contentType?: string;
	size?: string;
	width?: number;
	height?: number;
	matchesCancelledAsset?: boolean;
}

export interface E2eSeedScanAttempt {
	id?: string;
	customerId: string;
	scannerUid?: string;
	scannedOn: string;
	priorEventOn: string;
	programYear?: number;
	outcome: 'duplicate-accidental' | 'duplicate-risk' | 'cancelled';
	inputMethod?: 'camera' | 'manual';
	codeSuffix?: string;
}

export interface E2eSeedScanRiskSummary {
	id?: string;
	customerId: string;
	firstName: string;
	lastName: string;
	emailAddress: string;
	firstRiskOn: string;
	latestRiskOn: string;
	programYear?: number;
	accidentalAttemptCount?: number;
	lateDuplicateAttemptCount?: number;
	cancelledCodeAttemptCount?: number;
	totalRiskAttemptCount?: number;
	latestOutcome?: 'duplicate-risk' | 'cancelled';
	originalCheckInOn?: string;
}

export interface E2eSeedScanRiskHistory {
	attempts?: E2eSeedScanAttempt[];
	summaries?: E2eSeedScanRiskSummary[];
}

export interface E2eRegistrationScanAudit {
	uid: string;
	rawCodePersisted: boolean;
	attempts: {
		id: string;
		customerId: string;
		scannerUid: string;
		scannedOn: string;
		priorEventOn: string;
		programYear: number;
		outcome: 'duplicate-accidental' | 'duplicate-risk' | 'cancelled';
		elapsedSeconds: number;
		inputMethod: 'camera' | 'manual';
		codeFingerprint: string;
		codeSuffix: string;
	}[];
	summaries: {
		id: string;
		customerId: string;
		programYear: number;
		firstName: string;
		lastName: string;
		emailAddress: string;
		accidentalAttemptCount: number;
		lateDuplicateAttemptCount: number;
		cancelledCodeAttemptCount: number;
		totalRiskAttemptCount: number;
		firstRiskOn: string;
		latestRiskOn: string;
		latestOutcome: 'duplicate-risk' | 'cancelled';
		originalCheckInOn?: string;
	}[];
}

export interface E2eQueuedRegistrationEmailSnapshot {
	id: string;
	collection: 'tmp_registrationemails' | 'tmp_registrationemails2';
	queueSource?: string;
	deliveryState?: string;
	qrCodeStoragePath?: string;
	hasConfirmationCode: boolean;
	queuedOn?: string;
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

interface CustomFixtures {
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
	/** Read the real emulator registration and Storage QR lifecycle. */
	inspectRegistrationQrLifecycle: (
		emailAddress: string,
	) => Promise<E2eRegistrationQrLifecycle>;
	/** Reads safe persisted scan-attempt/audit evidence for one customer. */
	inspectRegistrationScanAudit: (
		emailAddress: string,
	) => Promise<E2eRegistrationScanAudit>;
	/** Reads immutable QR-path snapshots from queued registration emails. */
	inspectQueuedRegistrationEmails: (
		emailAddress: string,
	) => Promise<E2eQueuedRegistrationEmailSnapshot[]>;
	/** Seeds multi-day/current-or-prior-program-year scan-risk data. */
	seedScanRiskHistory: (seed: E2eSeedScanRiskHistory) => Promise<void>;
}

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
	data?: unknown,
	attempt = 0,
): Promise<unknown> {
	const response = await fetch(`${FUNCTIONS_EMULATOR_URL}/${functionName}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ data: data ?? {} }),
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

	const result = (await response.json()) as { result: unknown };
	return result.result;
}

export const test = base.extend<CustomFixtures>({
	seedScenario: async ({}, use): Promise<void> => {
		const seedScenario = async (scenario: string): Promise<void> => {
			await callFunction('testSeedScenario', { scenario });
		};
		await use(seedScenario);
	},

	clearData: async ({}, use): Promise<void> => {
		const clearData = async (): Promise<void> => {
			await callFunction('testClearAllData');
		};
		await use(clearData);
	},

	seedPublicParams: async ({}, use): Promise<void> => {
		const seedPublicParams = async (
			params: E2ePublicParameters,
		): Promise<void> => {
			await callFunction('testSeedPublicParameters', params);
		};
		await use(seedPublicParams);
	},

	seedAdminUser: async ({}, use): Promise<void> => {
		const seedAdminUser = async (
			user: E2eAdminSeedUser,
		): Promise<{ uid: string }> =>
			callFunction('testSeedAdminUser', user) as Promise<{ uid: string }>;
		await use(seedAdminUser);
	},

	seedDateTimeSlots: async ({}, use): Promise<void> => {
		const seedDateTimeSlots = async (
			slots: E2eSeedDateTimeSlot[],
		): Promise<{ ids: string[] }> =>
			callFunction('testSeedDateTimeSlots', {
				slots,
			}) as Promise<{ ids: string[] }>;
		await use(seedDateTimeSlots);
	},

	seedRegistrationSearchIndex: async ({}, use): Promise<void> => {
		const seedRegistrationSearchIndex = async (
			records: E2eSeedRegistrationSearchIndex[],
		): Promise<{ ids: string[] }> =>
			callFunction('testSeedRegistrationSearchIndex', {
				records,
			}) as Promise<{ ids: string[] }>;
		await use(seedRegistrationSearchIndex);
	},

	seedScheduleStats: async ({}, use): Promise<void> => {
		const seedScheduleStats = async (
			stats: E2eSeedScheduleStats,
		): Promise<void> => {
			await callFunction('testSeedScheduleStats', stats);
		};
		await use(seedScheduleStats);
	},

	seedReportingStats: async ({}, use): Promise<void> => {
		const seedReportingStats = async (
			stats: E2eSeedReportingStats,
		): Promise<void> => {
			await callFunction('testSeedReportingStats', stats);
		};
		await use(seedReportingStats);
	},

	seedCheckIn: async ({}, use): Promise<void> => {
		const seedCheckIn = async (
			emailAddress: string,
		): Promise<{ uid: string }> =>
			callFunction('testSeedCheckIn', { emailAddress }) as Promise<{
				uid: string;
			}>;
		await use(seedCheckIn);
	},

	seedRegistration: async ({}, use): Promise<void> => {
		const seedRegistration = async (
			registration: E2eSeedRegistration,
		): Promise<void> => {
			await callFunction('testSeedRegistration', registration);
		};
		await use(seedRegistration);
	},

	inspectRegistrationQrLifecycle: async ({}, use): Promise<void> => {
		const inspectRegistrationQrLifecycle = async (
			emailAddress: string,
		): Promise<E2eRegistrationQrLifecycle> =>
			callFunction('testInspectRegistrationQrLifecycle', {
				emailAddress,
			}) as Promise<E2eRegistrationQrLifecycle>;
		await use(inspectRegistrationQrLifecycle);
	},

	inspectRegistrationScanAudit: async ({}, use): Promise<void> => {
		const inspectRegistrationScanAudit = async (
			emailAddress: string,
		): Promise<E2eRegistrationScanAudit> =>
			callFunction('testInspectRegistrationScanAudit', { emailAddress }) as Promise<E2eRegistrationScanAudit>;
		await use(inspectRegistrationScanAudit);
	},

	inspectQueuedRegistrationEmails: async ({}, use): Promise<void> => {
		const inspectQueuedRegistrationEmails = async (
			emailAddress: string,
		): Promise<E2eQueuedRegistrationEmailSnapshot[]> =>
			callFunction('testInspectQueuedRegistrationEmails', { emailAddress }) as Promise<E2eQueuedRegistrationEmailSnapshot[]>;
		await use(inspectQueuedRegistrationEmails);
	},

	seedScanRiskHistory: async ({}, use): Promise<void> => {
		const seedScanRiskHistory = async (
			seed: E2eSeedScanRiskHistory,
		): Promise<void> => {
			await callFunction('testSeedScanRiskHistory', seed);
		};
		await use(seedScanRiskHistory);
	},
});

export { expect } from '@playwright/test';
