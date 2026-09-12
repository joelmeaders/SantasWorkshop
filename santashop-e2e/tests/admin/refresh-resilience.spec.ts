import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { E2E_PROGRAM_YEAR, e2eDateTime } from '../../fixtures/season';

const year = E2E_PROGRAM_YEAR;

async function createStaff(page: Page): Promise<void> {
	await page.goto('/admin/users');
	await page.getByTitle('Add user').click();
	const modal = page.locator('ion-modal');
	for (const [field, value] of [
		['emailAddress', 'return-staff@test.com'],
		['displayName', 'Return Staff'],
		['password', 'Test1234!'],
	]) {
		await modal
			.locator(`ion-input[formControlName="${field}"] input`)
			.fill(value);
	}
	await modal.locator('ion-select[formControlName="roles"]').click();
	await page
		.locator('ion-alert')
		.getByText('Check-In', { exact: true })
		.click();
	await page
		.locator('ion-alert')
		.getByRole('button', { name: 'OK', exact: true })
		.click();
	await modal
		.getByRole('button', { name: 'Create user', exact: true })
		.click();
	await expect(page.locator('ion-alert')).toContainText('User created.');
	await page
		.locator('ion-alert')
		.getByRole('button', { name: 'OK', exact: true })
		.click();
	await expect(page.getByText('Return Staff', { exact: true })).toBeVisible();
}
const stats = (
	count: number,
	programYear = year,
): {
	programYear: number;
	dateTimeCounts: { dateTime: string; count: number }[];
} => ({
	programYear,
	dateTimeCounts: [
		{ dateTime: e2eDateTime(12, 12, 17, 0, 0, programYear), count },
	],
});

async function chooseYear(page: Page, value: number): Promise<void> {
	await page.locator('admin-header ion-select').click();
	const picker = page.locator('ion-alert');
	await picker
		.getByRole('radio', { name: String(value), exact: true })
		.click();
	await picker.getByRole('button', { name: 'OK', exact: true }).click();
	await expect(picker).toBeHidden();
}

async function denyReads(page: Page, pattern: string): Promise<void> {
	await page.route(pattern, (route) =>
		route.fulfill({
			status: 403,
			contentType: 'application/json',
			body: JSON.stringify({
				error: {
					status: 'PERMISSION_DENIED',
					message: 'Injected read failure',
				},
			}),
		}),
	);
}

test.describe('admin refresh navigation and recovery', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('REFRESH-006 report reloads after in-app back and return without reloading the document', async ({
		page,
		seedScheduleStats,
	}) => {
		await seedScheduleStats(stats(2));
		await signInAdminViaUi(page, defaultAdminAccount());
		await page
			.locator('ion-item[routerLink="../stats/registration"]')
			.click();
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'2',
		);
		const documentStarted = await page.evaluate(
			() => performance.timeOrigin,
		);
		await page.getByRole('link', { name: 'Go back', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/landing$/);
		await seedScheduleStats(stats(8));
		await page
			.locator('ion-item[routerLink="../stats/registration"]')
			.click();
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'8',
		);
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(
			documentStarted,
		);
	});

	test('REFRESH-007 staff list reloads on in-app return', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.locator('ion-item[routerLink="../users"]').click();
		await expect(
			page.getByText('No elevated user accounts yet.', { exact: false }),
		).toBeVisible();
		const documentStarted = await page.evaluate(
			() => performance.timeOrigin,
		);
		await page.getByRole('link', { name: 'Go back', exact: true }).click();
		const writer = await page.context().newPage();
		try {
			await createStaff(writer);
		} finally {
			await writer.close();
		}
		await page.locator('ion-item[routerLink="../users"]').click();
		await expect(
			page.getByText('return-staff@test.com', { exact: true }),
		).toBeVisible();
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(
			documentStarted,
		);
	});

	test('REFRESH-008 registration report keeps the selected year through refresh and clears missing-year data', async ({
		page,
		seedScheduleStats,
	}) => {
		await seedScheduleStats(stats(3));
		await seedScheduleStats(stats(7, year - 1));
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/registration');
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'3',
		);
		await chooseYear(page, year - 1);
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'7',
		);
		await seedScheduleStats(stats(11, year - 1));
		await page
			.getByRole('button', { name: 'Refresh report', exact: true })
			.click();
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'11',
		);
		await expect(page.locator('admin-header ion-select')).toHaveJSProperty(
			'value',
			year - 1,
		);
		await chooseYear(page, year - 2);
		await expect(
			page.getByText('No appointment data for this year', {
				exact: true,
			}),
		).toBeVisible();
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'0',
		);
		await chooseYear(page, year);
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'3',
		);
	});

	for (const report of ['registration', 'check-in'] as const) {
		test(`RECOVERY-${report} report retries a failed read without a page reload`, async ({
			page,
			seedScheduleStats,
			seedReportingStats,
		}) => {
			await seedScheduleStats(stats(6));
			await seedReportingStats({
				checkIn: {
					programYear: year,
					lastUpdated: `${year}-12-12T18:00:00.000Z`,
					dateTimeCount: [
						{
							date: 12,
							hour: 17,
							customerCount: 6,
							childCount: 8,
							pregisteredCount: 0,
							modifiedCount: 0,
						},
					],
				},
			});
			await signInAdminViaUi(page, defaultAdminAccount());
			await page.goto(`/admin/stats/${report}`);
			await expect(
				page.locator('.count-container h1').first(),
			).toHaveText('6');
			await denyReads(page, '**/documents:batchGet**');
			await page
				.getByRole('button', { name: 'Refresh report', exact: true })
				.click();
			await expect(page.getByRole('alert')).toContainText(
				'could not be loaded',
			);
			await page.unroute('**/documents:batchGet**');
			await page
				.getByRole('button', { name: 'Refresh report', exact: true })
				.click();
			await expect(
				page.locator('.count-container h1').first(),
			).toHaveText('6');
			await expect(page.getByRole('alert')).toHaveCount(0);
		});
	}

	test('RECOVERY-USERS retries a failed staff query', async ({ page }) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await createStaff(page);
		await denyReads(page, '**/documents:runQuery**');
		await page
			.getByRole('button', { name: 'Refresh users', exact: true })
			.click();
		await expect(page.getByRole('alert')).toContainText(
			'Users could not be loaded',
		);
		await page.unroute('**/documents:runQuery**');
		await page
			.getByRole('button', { name: 'Refresh users', exact: true })
			.click();
		await expect(
			page.getByText('Return Staff', { exact: true }),
		).toBeVisible();
		await expect(page.getByRole('alert')).toHaveCount(0);
	});

	test('REFRESH-009 scan-risk back navigation reloads counts and preserves the expanded list', async ({
		page,
		seedScanRiskHistory,
	}) => {
		const summaries = Array.from({ length: 21 }, (_, index) => ({
			id: `return-risk-${index}`,
			customerId: `return-risk-${index}`,
			firstName: 'Return',
			lastName: `Family ${index}`,
			emailAddress: `return-risk-${index}@test.com`,
			programYear: year,
			firstRiskOn: `${year}-12-12T17:00:00.000Z`,
			latestRiskOn: `${year}-12-12T17:${String(index).padStart(2, '0')}:00.000Z`,
			totalRiskAttemptCount: 1,
			lateDuplicateAttemptCount: 1,
		}));
		await seedScanRiskHistory({ summaries });
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.locator('#scanRiskReviewNav').click();
		const rows = page.locator(
			'ion-list[aria-label="Shoppers with suspicious scans"] ion-item',
		);
		await expect(rows).toHaveCount(20);
		await page
			.getByRole('button', { name: 'Load more', exact: true })
			.click();
		await expect(rows).toHaveCount(21);
		await page.getByText('Return Family 20', { exact: true }).click();
		await expect(
			page.getByText('No current-season scan history', { exact: true }),
		).toBeVisible();
		await seedScanRiskHistory({
			summaries: [
				{
					...summaries[20],
					totalRiskAttemptCount: 4,
					lateDuplicateAttemptCount: 4,
				},
			],
		});
		await page
			.getByRole('banner')
			.filter({
				has: page.getByRole('heading', {
					name: 'Customer Scan Timeline',
					exact: true,
				}),
			})
			.getByRole('link', { name: 'Go back', exact: true })
			.click();
		await expect(page).toHaveURL(/\/admin\/stats\/scan-risk$/);
		await expect(rows).toHaveCount(21);
		await expect(
			rows.filter({ hasText: 'Return Family 20' }),
		).toContainText('4 risk attempt(s)');
		await page
			.getByRole('button', { name: 'Refresh scan risks', exact: true })
			.click();
		await expect(rows).toHaveCount(21);
	});

	test('RECOVERY-SEARCH retries the same query after a connection failure', async ({
		page,
		seedRegistrationSearchIndex,
	}) => {
		await seedRegistrationSearchIndex([
			{
				id: 'retry-search',
				customerId: 'retry-search',
				firstName: 'Retry',
				lastName: 'Family',
				emailAddress: 'retry@test.com',
				zip: '80202',
				code: 'RETRY001',
			},
		]);
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/search/by-email');
		await page
			.locator('ion-input[formControlName="emailAddress"] input')
			.fill('retry@test.com');
		await page.route('**/documents:runQuery**', (route) =>
			route.abort('internetdisconnected'),
		);
		await page.getByRole('link', { name: 'Search', exact: true }).click();
		await expect(page.getByRole('alert')).toBeVisible();
		await page.unroute('**/documents:runQuery**');
		await page
			.getByRole('button', { name: 'Refresh results', exact: true })
			.click();
		await expect(page.locator('.result-item')).toHaveCount(1);
		await expect(page.locator('.result-item')).toContainText(
			'Retry Family',
		);
		await expect(page.getByRole('alert')).toHaveCount(0);
	});
});
