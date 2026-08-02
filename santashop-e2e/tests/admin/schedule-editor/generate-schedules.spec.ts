import { test, expect } from '../../../fixtures/test-fixtures';
import {
	defaultOwnerAccount,
	fillIonicInput,
	navigateToScheduleEditorViaLanding,
	signInAdminViaUi,
} from '../../../fixtures/admin-helpers';

test.describe('admin schedule editor - generate schedules', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultOwnerAccount());
	});

	test('should generate hourly schedules for a single date range', async ({
		page,
	}) => {
		// Arrange
		const adminAccount = defaultOwnerAccount();

		// Act
		await signInAdminViaUi(page, adminAccount);
		await navigateToScheduleEditorViaLanding(page);
		await expect(page.locator('#generateSchedulesButton')).toBeVisible();
		await fillIonicInput(page, '#generateStartDate', '2026-12-12');
		await fillIonicInput(page, '#generateEndDate', '2026-12-12');
		await fillIonicInput(page, '#generateCapacity', '20');
		await page.click('#generateSchedulesButton');
		const alert = page.locator('ion-alert');
		await expect(alert).toBeVisible();
		await alert
			.getByRole('textbox', { name: 'Account password' })
			.fill(adminAccount.password);
		await alert.getByRole('textbox', {
			name: 'Exact confirmation phrase',
		}).fill(
			'INITIALIZE SCHEDULE demo-santashop 2026',
		);
		await alert.getByRole('button', { name: 'Initialize' }).click();

		// Assert
		await expect(page.locator('text=Saturday, Dec 12, 2026')).toBeVisible();
		await expect(page.locator('text=5 slots')).toBeVisible();
		await expect(page.locator('[id^="scheduleRow-"]')).toHaveCount(5);
		await expect(
			page.locator('[id^="scheduleRow-"]').first(),
		).toContainText('Reserved 0 of 20');
	});

	test('SCHED-003 skips duplicate generated slots and preserves the existing row', async ({
		page,
		seedDateTimeSlots,
	}) => {
		await seedDateTimeSlots([
			{
				id: '2026-20261212180000000',
				programYear: 2026,
				dateTime: '2026-12-12T18:00:00.000Z',
				maxSlots: 99,
				slotsReserved: 2,
			},
		]);
		const adminAccount = defaultOwnerAccount();
		await signInAdminViaUi(page, adminAccount);
		await navigateToScheduleEditorViaLanding(page);
		await fillIonicInput(page, '#generateStartDate', '2026-12-12');
		await fillIonicInput(page, '#generateEndDate', '2026-12-12');
		await fillIonicInput(page, '#generateCapacity', '20');
		await page.locator('#generateSchedulesButton').click();
		const alert = page.locator('ion-alert');
		await alert
			.getByRole('textbox', { name: 'Account password' })
			.fill(adminAccount.password);
		await alert
			.getByRole('textbox', { name: 'Exact confirmation phrase' })
			.fill('INITIALIZE SCHEDULE demo-santashop 2026');
		await alert.getByRole('button', { name: 'Initialize' }).click();

		await expect(page.getByText('Created 4 schedules and skipped 1 duplicates.')).toBeVisible();
		await expect(page.locator('[id^="scheduleRow-"]')).toHaveCount(5);
		await expect(
			page.locator('#scheduleRow-2026-20261212180000000'),
		).toContainText('Reserved 2 of 99');
	});
});
