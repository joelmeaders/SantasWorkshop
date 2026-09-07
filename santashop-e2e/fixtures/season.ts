import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { config } from '../../santashop-app/src/config';

const requireFromE2e = createRequire(__filename);
const { loadEnvFiles } = requireFromE2e('../../scripts/env-loader.cjs') as {
	loadEnvFiles: (filePaths: string[]) => void;
};

loadEnvFiles([resolve(__dirname, '../../.env')]);

const parseConfiguredYear = (key: string): number | undefined => {
	const value = process.env[key];
	if (value === undefined || value.trim() === '') return undefined;
	const year = Number(value);
	if (!Number.isInteger(year) || year < 2000 || year > 2100) {
		throw new Error(
			`${key} must be a four-digit year between 2000 and 2100 for E2E tests.`,
		);
	}
	return year;
};

const testProgramYear = parseConfiguredYear('TEST_SANTASHOP_PROGRAM_YEAR');
const localProgramYear = parseConfiguredYear('LOCAL_SANTASHOP_PROGRAM_YEAR');
if (
	testProgramYear !== undefined &&
	localProgramYear !== undefined &&
	testProgramYear !== localProgramYear
) {
	throw new Error(
		`TEST_SANTASHOP_PROGRAM_YEAR (${testProgramYear}) and LOCAL_SANTASHOP_PROGRAM_YEAR (${localProgramYear}) must match for E2E tests.`,
	);
}

export const E2E_PROGRAM_YEAR =
	testProgramYear ?? localProgramYear ?? config.programYear;
export const E2E_PROJECT_ID =
	process.env['E2E_EMULATOR_PROJECT'] ?? 'demo-santashop';
export const E2E_FUNCTIONS_EMULATOR_URL =
	process.env['FUNCTIONS_EMULATOR_URL'] ??
	`http://127.0.0.1:${process.env['E2E_FUNCTIONS_PORT'] ?? 5001}/${E2E_PROJECT_ID}/us-central1`;
const emulatorUrl = (portKey: string, defaultPort: number): string =>
	`http://127.0.0.1:${process.env[portKey] ?? defaultPort}`;
export const E2E_AUTH_EMULATOR_URL =
	emulatorUrl('E2E_AUTH_PORT', 9099);
export const E2E_FIRESTORE_EMULATOR_URL =
	emulatorUrl('E2E_FIRESTORE_PORT', 8180);
export const E2E_STORAGE_EMULATOR_URL =
	emulatorUrl('E2E_STORAGE_PORT', 9199);
export const E2E_STORAGE_BUCKET = `${E2E_PROJECT_ID}.appspot.com`;

const pad = (value: number): string => value.toString().padStart(2, '0');

/** Return a date input value in the configured E2E program year. */
export const e2eDate = (
	month: number,
	day: number,
	year = E2E_PROGRAM_YEAR,
): string => `${year}-${pad(month)}-${pad(day)}`;

/** Return an ISO timestamp for a UTC test fixture date. */
export const e2eDateTime = (
	month: number,
	day: number,
	hour: number,
	minute = 0,
	second = 0,
	year = E2E_PROGRAM_YEAR,
): string =>
	new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();

/** Return the stable ID used by schedule initialization for a date-time slot. */
export const e2eScheduleSlotId = (
	dateTime: string,
	programYear = E2E_PROGRAM_YEAR,
): string => `${programYear}-${dateTime.replaceAll(/[^0-9]/g, '')}`;

/** Return the event date label shown by the app in its business timezone. */
export const e2eDateLabel = (dateTime: string): string =>
	new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'America/Denver',
	}).format(new Date(dateTime));

/** Return a month-day label for a date-only field in a configured year. */
export const e2eCalendarDateLabel = (
	month: number,
	day: number,
	year = E2E_PROGRAM_YEAR,
): string =>
	new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(new Date(Date.UTC(year, month - 1, day, 12)));

export const e2eScheduleInitializationPhrase = (): string =>
	`INITIALIZE SCHEDULE ${E2E_PROJECT_ID} ${E2E_PROGRAM_YEAR}`;
