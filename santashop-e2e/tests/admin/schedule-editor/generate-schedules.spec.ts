import { test, expect } from '../../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	fillIonicInput,
	navigateToScheduleEditorViaLanding,
	signInAdminViaUi,
} from '../../../fixtures/admin-helpers';

test.describe('admin schedule editor - generate schedules', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('should generate hourly schedules for a single date range', async ({
		page,
	}) => {
		// Arrange
		const adminAccount = defaultAdminAccount();

		// Act
		await signInAdminViaUi(page, adminAccount);
		await navigateToScheduleEditorViaLanding(page);
		await fillIonicInput(page, '#generateStartDate', '2025-12-12');
		await fillIonicInput(page, '#generateEndDate', '2025-12-12');
		await fillIonicInput(page, '#generateCapacity', '20');
		await page.click('#generateSchedulesButton');

		// Assert
		await expect(page.locator('text=5 total schedules')).toBeVisible();
		await expect(page.locator('[id^="scheduleRow-"]')).toHaveCount(5);
		await expect(page.locator('[id^="scheduleRow-"]').first()).toContainText(
			'Reserved 0 of 20',
		);
	});
});
