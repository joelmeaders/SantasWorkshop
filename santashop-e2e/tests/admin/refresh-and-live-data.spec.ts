import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	scheduleSlot,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { E2E_PROGRAM_YEAR, e2eDateTime } from '../../fixtures/season';

test.describe('admin data freshness', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('REFRESH-001 registration report fetches new aggregates only when refreshed', async ({
		page,
		seedScheduleStats,
	}) => {
		await seedScheduleStats({
				programYear: E2E_PROGRAM_YEAR,
			dateTimeCounts: [
				{ dateTime: e2eDateTime(12, 12, 16), count: 2 },
			],
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/registration');
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'2',
		);
		await seedScheduleStats({
				programYear: E2E_PROGRAM_YEAR,
			dateTimeCounts: [
				{ dateTime: e2eDateTime(12, 12, 16), count: 9 },
			],
		});
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'2',
		);
		await page
			.getByRole('button', { name: 'Refresh report', exact: true })
			.click();
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'9',
		);
	});

	test('REFRESH-002 check-in report loads new records from its empty state', async ({
		page,
		seedReportingStats,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/check-in');
		await expect(
			page.getByText('No check-ins have been recorded for this year.', {
				exact: true,
			}),
		).toBeVisible();
		await seedReportingStats({
			checkIn: {
				programYear: E2E_PROGRAM_YEAR,
				lastUpdated: e2eDateTime(12, 12, 18),
				dateTimeCount: [
					{
						date: 12,
						hour: 16,
						customerCount: 7,
						childCount: 9,
						pregisteredCount: 0,
						modifiedCount: 0,
					},
				],
			},
		});
		await expect(
			page.getByText('No check-ins have been recorded for this year.', {
				exact: true,
			}),
		).toBeVisible();
		await page
			.getByRole('button', { name: 'Refresh report', exact: true })
			.click();
		await expect(page.locator('.count-container h1').first()).toHaveText(
			'7',
		);
	});

	test('REFRESH-003 shopper report recovers from failed reads and loads new data on refresh', async ({
		page,
		seedReportingStats,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/user');
		await expect(
			page.getByText('No shopper data for this year.', {
				exact: true,
			}),
		).toBeVisible();
		await seedReportingStats({
			user: {
				programYear: E2E_PROGRAM_YEAR,
				totalUsers: 4,
				referrerCount: [{ referrer: 'SNAP', count: 4 }],
				zipCodeCount: [{ zip: '80202', count: 4 }],
			},
		});
		await expect(page.locator('canvas')).toHaveCount(0);
		// Fail only Firestore Lite reads; authentication and seeding still use the real emulators.
		await page.route('**/documents:batchGet**', (route) =>
			route.fulfill({
				status: 403,
				contentType: 'application/json',
				body: JSON.stringify({
					error: {
						status: 'PERMISSION_DENIED',
						message: 'Read failure for retry test',
					},
				}),
			}),
		);
		await page
			.getByRole('button', { name: 'Refresh report', exact: true })
			.click();
		await expect(page.getByRole('alert')).toContainText(
			'Report could not be loaded',
		);
		await page.unroute('**/documents:batchGet**');
		await page
			.getByRole('button', { name: 'Refresh report', exact: true })
			.click();
		await expect(page.locator('canvas')).toHaveCount(2);
		await expect(page.getByRole('alert')).toHaveCount(0);
	});

	test('REFRESH-004 scan-risk list and timeline show new records after refresh', async ({
		page,
		seedScanRiskHistory,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/scan-risk');
		await expect(
			page.getByText('No suspicious scans this season', { exact: true }),
		).toBeVisible();
		await seedScanRiskHistory({
			summaries: [
				{
					customerId: 'refresh-customer',
					firstName: 'Refresh',
					lastName: 'Family',
					emailAddress: 'refresh@example.com',
					firstRiskOn: e2eDateTime(12, 12, 18),
					latestRiskOn: e2eDateTime(12, 12, 18),
					totalRiskAttemptCount: 1,
					lateDuplicateAttemptCount: 1,
				},
			],
		});
		await expect(
			page.getByText('Refresh Family', { exact: true }),
		).toHaveCount(0);
		await page.getByRole('button', { name: 'Refresh scan risks' }).click();
		await page.getByText('Refresh Family', { exact: true }).click();
		await expect(
			page.getByText('No current-season scan history', { exact: true }),
		).toBeVisible();
		await seedScanRiskHistory({
			attempts: [
				{
					id: 'refresh-attempt',
					customerId: 'refresh-customer',
					scannedOn: e2eDateTime(12, 12, 18),
					priorEventOn: e2eDateTime(12, 12, 16),
					outcome: 'duplicate-risk',
				},
			],
		});
		await expect(
			page.getByRole('heading', { name: 'duplicate-risk', exact: true }),
		).toHaveCount(0);
		await page.getByRole('button', { name: 'Refresh timeline' }).click();
		await expect(
			page.getByRole('heading', { name: 'duplicate-risk', exact: true }),
		).toBeVisible();
	});

	test('LIVE-001 operational flags change without navigation or refresh', async ({
		page,
		seedPublicParams,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		const flags = {
			checkinEnabled: false,
			onsiteRegistrationEnabled: false,
			preRegistrationEnabled: false,
			allowCancelRegistration: false,
			allowChangeRegistration: false,
		};
		await seedPublicParams({ admin: flags });
		for (const id of [
			'checkInNav',
			'onSiteRegistrationNav',
			'preRegistrationNav',
		]) {
			await expect(page.locator('#' + id)).toHaveAttribute(
				'disabled',
				'',
			);
		}
		await seedPublicParams({
			admin: {
				...flags,
				checkinEnabled: true,
				onsiteRegistrationEnabled: true,
				preRegistrationEnabled: true,
			},
		});
		for (const id of [
			'checkInNav',
			'onSiteRegistrationNav',
			'preRegistrationNav',
		]) {
			await expect(page.locator('#' + id)).not.toHaveAttribute(
				'disabled',
				'',
			);
		}
	});

	test('LIVE-003 appointment options update in open registration and change-date views', async ({
		page,
		seedDateTimeSlots,
		seedRegistration,
	}) => {
		const slot = scheduleSlot({
			id: 'picker-slot',
			dateTime: e2eDateTime(12, 12, 10),
		});
		await seedDateTimeSlots([slot]);
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/pre-registration');
		const options = page.locator(
			'ion-select[formControlName="dateTimeSlot"] ion-select-option',
		);
		await expect(options).toHaveCount(1);
		await seedDateTimeSlots([{ ...slot, enabled: false }]);
		await expect(options).toHaveCount(0);
		await seedDateTimeSlots([slot]);
		await expect(options).toHaveCount(1);
		await seedRegistration({
			uid: 'live-picker-customer',
			firstName: 'Live',
			lastName: 'Picker',
			emailAddress: 'picker@example.com',
			zipCode: '80202',
			code: 'LIVEPICK',
			dateTime: e2eDateTime(12, 12, 17),
		});
		await page.goto('/admin/checkin/review;qrcode=LIVEPICK');
		await page
			.getByRole('button', { name: 'Change Date/Time', exact: true })
			.click();
		const modal = page.locator('ion-modal');
		await expect(modal.locator('ion-accordion')).toHaveCount(1);
		await seedDateTimeSlots([{ ...slot, enabled: false }]);
		await expect(
			modal.getByText('No available time slots at this time.', {
				exact: true,
			}),
		).toBeVisible();
		await seedDateTimeSlots([slot]);
		await expect(modal.locator('ion-accordion')).toHaveCount(1);
	});

	test('LIVE-002 schedule capacity changes arrive while the editor stays open', async ({
		page,
		seedDateTimeSlots,
	}) => {
		const slot = scheduleSlot({
			id: 'live-slot',
			dateTime: e2eDateTime(12, 12, 10),
			maxSlots: 10,
		});
		await seedDateTimeSlots([slot]);
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/schedule-editor');
		await expect(page.locator('#scheduleRow-live-slot')).toContainText(
			'Reserved 0 of 10',
		);
		await seedDateTimeSlots([{ ...slot, slotsReserved: 4, maxSlots: 12 }]);
		await expect(page.locator('#scheduleRow-live-slot')).toContainText(
			'Reserved 4 of 12',
		);
	});
});
