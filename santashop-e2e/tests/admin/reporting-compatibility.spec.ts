import { readFile } from 'node:fs/promises';
import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { E2E_PROGRAM_YEAR, e2eDateTime } from '../../fixtures/season';

test.describe('report compatibility and exports', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('REPORT-LEGACY-005 preserves old totals and marks new calculations unavailable', async ({
		page,
		seedReportingStats,
	}) => {
		await seedReportingStats({
			registration: {
				programYear: E2E_PROGRAM_YEAR,
				completedRegistrations: 7,
				dateTimeCount: [
					{
						dateTime: e2eDateTime(12, 12, 16),
						count: 7,
						childCount: 14,
						stats: {
							infants: {
								total: 0,
								age02: 0,
								age35: 0,
								age68: 0,
								age911: 0,
							},
							girls: {
								total: 7,
								age02: 0,
								age35: 7,
								age68: 0,
								age911: 0,
							},
							boys: {
								total: 7,
								age02: 0,
								age35: 0,
								age68: 7,
								age911: 0,
							},
						},
					},
				],
				zipCodeCount: [{ zip: 80202, count: 7, childCount: 14 }],
			},
		});
		const pageErrors: Error[] = [];
		page.on('pageerror', (error) => pageErrors.push(error));
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/registration');
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'7',
		);
		await expect(page.locator('.count-container h1').nth(1)).toHaveText(
			'14',
		);
		await expect(
			page.getByText(
				'Registration progress was not saved in this report.',
			),
		).toBeVisible();
		await expect(
			page.getByText('Update time not saved in this report.').first(),
		).toBeVisible();
		await expect(
			page.getByRole('table', {
				name: 'Registration ZIP codes',
				exact: true,
			}),
		).toContainText('80202');
		await page
			.getByRole('button', { name: 'Refresh report', exact: true })
			.click();
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'7',
		);
		expect(pageErrors).toEqual([]);
	});

	test('REPORT-EXPORT-006 exports all referrals and escapes spreadsheet formulas', async ({
		page,
		seedReportingStats,
	}) => {
		await seedReportingStats({
			user: {
				programYear: E2E_PROGRAM_YEAR,
				totalUsers: 3,
				referrerCount: [
					{ referrer: '=1+1', count: 1 },
					{ referrer: 'School, "North"', count: 2 },
				],
				zipCodeCount: [{ zip: '80202', count: 3 }],
			},
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/user');
		const table = page.getByRole('table', {
			name: 'Shopper referrals',
			exact: true,
		});
		await expect(table).toContainText('=1+1');
		await expect(table).toContainText('School, "North"');
		const pendingDownload = page.waitForEvent('download');
		await page
			.getByRole('button', {
				name: 'Download Shopper referrals CSV',
				exact: true,
			})
			.click();
		const download = await pendingDownload;
		expect(download.suggestedFilename()).toContain(
			String(E2E_PROGRAM_YEAR),
		);
		expect(download.suggestedFilename()).toMatch(/\.csv$/);
		const filePath = await download.path();
		expect(filePath).not.toBeNull();
		if (!filePath)
			throw new Error(
				'The report download did not produce a local file.',
			);
		const csv = await readFile(filePath, 'utf8');
		expect(csv).toContain("'=1+1");
		expect(csv).toContain('School, ""North""');
		expect(await download.failure()).toBeNull();
	});

	test('REPORT-CURRENT-007 loads new outcome snapshots without requiring demographic data', async ({
		page,
		seedReportingStats,
	}) => {
		const calculatedAt = new Date().toISOString();
		const operational = {
			coverage: 'current-records' as const,
			registrationRecords: 4,
			submittedRegistrations: 3,
			draftRegistrations: 1,
			cancelledRegistrations: 0,
			recordedCancellationEvents: 0,
			checkedInRegistrations: 0,
			pastAppointmentRegistrations: 0,
			attendedPastAppointments: 0,
			unconfirmedPastAppointments: 0,
			attendanceStatusUnavailable: 0,
			missingAppointmentRegistrations: 0,
			invalidSubmissionDates: 0,
			completionRate: 0.75,
		};
		await seedReportingStats({
			registration: {
				programYear: E2E_PROGRAM_YEAR,
				schemaVersion: 2,
				calculatedAt,
				completedRegistrations: 3,
				dateTimeCount: [],
				zipCodeCount: [],
				operational,
				dailySnapshots: [
					{
						...operational,
						dateKey: `${E2E_PROGRAM_YEAR}-09-10`,
						calculatedAt,
					},
				],
			},
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/registration');
		await expect(
			page.getByText(
				'Registration progress was not saved in this report.',
			),
		).toHaveCount(0);
		const outcomes = page.getByRole('table', {
			name: 'Registration progress',
			exact: true,
		});
		await expect(outcomes).toBeVisible();
		await expect(outcomes).toContainText('75');
		await expect(
			outcomes
				.locator('th small')
				.filter({
					hasText:
						'Completed registrations as a share of all saved registrations.',
				}),
		).toBeVisible();
		const history = page.getByRole('table', {
			name: 'Daily registration totals',
			exact: true,
		});
		await expect(history).toContainText(`${E2E_PROGRAM_YEAR}-09-10`);
		await page.reload();
		await expect(outcomes).toBeVisible();
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'3',
		);
	});
});
