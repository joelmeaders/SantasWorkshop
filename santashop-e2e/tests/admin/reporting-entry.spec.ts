import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('admin reporting routes', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('REPORT-ENTRY-001 opens each reporting view with a safe empty state', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());

		await page.goto('/admin/stats/registration');
		await expect(page.locator('admin-header')).toContainText(
			'Registration Stats',
		);
		await expect(
			page.getByText('No schedule data for this year', { exact: true }),
		).toBeVisible({ timeout: 15000 });

		await page.goto('/admin/stats/check-in');
		await expect(page.locator('admin-header')).toContainText('Check-In Stats');
		await expect(page.locator('[data-checkin-stats-loading]')).toHaveCount(0, {
			timeout: 15000,
		});
		await expect(
			page.getByText('No check-ins have been recorded for this year.', {
				exact: true,
			}),
		).toBeVisible({ timeout: 15000 });

		await page.goto('/admin/stats/user');
		await expect(page.locator('admin-header')).toContainText('User Stats');
	});

	test('REPORT-004 renders populated current-season schedule data', async ({
		page,
		seedScheduleStats,
	}) => {
		await seedScheduleStats({
			programYear: 2026,
			dateTimeCounts: [12, 13, 15, 16].map((day, index) => ({
				dateTime: `2026-12-${day.toString().padStart(2, '0')}T16:00:00.000Z`,
				count: index + 1,
			})),
		});
		const pageErrors: Error[] = [];
		page.on('pageerror', (error) => pageErrors.push(error));
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/registration');

		await expect(
			page.getByText('No schedule data for this year', { exact: true }),
		).toHaveCount(0, { timeout: 15000 });
		await expect(page.locator('.capacity-card')).toHaveCount(4, {
			timeout: 15000,
		});
		await expect(page.getByRole('heading', { name: '12th - Total: 1' })).toBeVisible();
		await expect(page.getByRole('heading', { name: '16th - Total: 4' })).toBeVisible();
		expect(pageErrors).toEqual([]);
	});

	test('REPORT-001 renders seeded registration demographics and ZIP distributions', async ({
		page,
		seedReportingStats,
	}) => {
		await seedReportingStats({
			registration: {
				programYear: 2026,
				completedRegistrations: 3,
				dateTimeCount: [
					{
						dateTime: '2026-12-12T16:00:00.000Z',
						count: 3,
						childCount: 4,
						stats: {
							infants: { total: 1, age02: 1, age35: 0, age68: 0, age911: 0 },
							girls: { total: 2, age02: 0, age35: 1, age68: 1, age911: 0 },
							boys: { total: 1, age02: 0, age35: 0, age68: 1, age911: 0 },
						},
					},
				],
				zipCodeCount: [{ zip: 80202, count: 2, childCount: 3 }],
			},
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/registration');

		await expect(page.locator('.count-container h1').first()).toHaveText('3');
		await expect(page.locator('.count-container h1').nth(1)).toHaveText('4');
		await expect(page.getByRole('heading', { name: 'Gender' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Top Zip Codes' })).toBeVisible();
		await expect(page.locator('canvas')).toHaveCount(2);
	});

	test('REPORT-002 renders seeded check-in counts by day and supports the children view', async ({
		page,
		seedReportingStats,
	}) => {
		await seedReportingStats({
			checkIn: {
				programYear: 2026,
				lastUpdated: '2026-12-12T18:00:00.000Z',
				dateTimeCount: [
					{
						date: 12,
						hour: 16,
						customerCount: 3,
						childCount: 4,
						pregisteredCount: 1,
						modifiedCount: 1,
					},
				],
			},
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/check-in');

		await expect(page.locator('.count-container h1').first()).toHaveText('3');
		await expect(page.locator('.count-container h1').nth(1)).toHaveText('4');
		await expect(page.getByRole('heading', { name: 'Check-Ins' })).toBeVisible();
		await page.getByRole('button', { name: 'View by Children' }).click();
		await expect(
			page.getByRole('heading', { name: 'Children', level: 2 }),
		).toBeVisible();
	});

	test('REPORT-003 renders seeded referral and ZIP user distributions', async ({
		page,
		seedReportingStats,
	}) => {
		await seedReportingStats({
			user: {
				programYear: 2026,
				totalUsers: 4,
				referrerCount: [{ referrer: 'SNAP', count: 3 }],
				zipCodeCount: [{ zip: '80202', count: 4 }],
			},
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/user');

		await expect(page.getByRole('heading', { name: 'Top 10 Referrers' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Top 10 Zip Codes' })).toBeVisible();
		await expect(page.locator('canvas')).toHaveCount(2);
	});
});
