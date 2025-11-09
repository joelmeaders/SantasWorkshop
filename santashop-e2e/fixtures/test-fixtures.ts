import { test as base } from '@playwright/test';

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
	seedPublicParams: (params: any) => Promise<void>;
};

// Firebase Functions emulator URL
const FUNCTIONS_EMULATOR_URL =
	'http://127.0.0.1:5001/santas-workshop-test/us-central1';

/**
 * Calls a Firebase function in the emulator
 */
async function callFunction(functionName: string, data?: any): Promise<any> {
	const response = await fetch(`${FUNCTIONS_EMULATOR_URL}/${functionName}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ data: data || {} }),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(
			`Function call failed: ${response.statusText} - ${errorBody}`,
		);
	}

	const result = await response.json();
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
		const seedPublicParams = async (params: any) => {
			await callFunction('testSeedPublicParameters', params);
		};
		await use(seedPublicParams);
	},
});

export { expect } from '@playwright/test';
