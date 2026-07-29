import { test, expect } from '../../../fixtures/test-fixtures';
import {
	clickIonCheckbox,
	defaultAdminAccount,
	fillIonicInput,
	navigateToScheduleEditorViaLanding,
	scheduleSlot,
	signInAdminViaUi,
} from '../../../fixtures/admin-helpers';

test.describe('admin schedule editor - edit and bulk update', () => {
	test.beforeEach(
		async ({
			clearData,
			seedPublicParams,
			seedAdminUser,
			seedDateTimeSlots,
		}) => {
			await clearData();
			await seedPublicParams({});
			await seedAdminUser(defaultAdminAccount());
			await seedDateTimeSlots([
				scheduleSlot({ id: 'slot-1', dateTime: '2025-12-12T10:00:00' }),
				scheduleSlot({ id: 'slot-2', dateTime: '2025-12-12T11:00:00' }),
			]);
		},
	);

	test('should apply an inline capacity edit to all selected rows', async ({
		page,
	}) => {
		// Arrange
		const adminAccount = defaultAdminAccount();

		// Act
		await signInAdminViaUi(page, adminAccount);
		await navigateToScheduleEditorViaLanding(page);
		await clickIonCheckbox(page, '#selectSchedule-slot-1');
		await clickIonCheckbox(page, '#selectSchedule-slot-2');
		await fillIonicInput(page, '#slotCapacity-slot-1', '12');

		// Assert
		await expect(page.locator('#scheduleEditorStatus')).toContainText(
			'Updated capacity on 2 schedules.',
		);
		await expect(page.locator('#scheduleRow-slot-1')).toContainText(
			'Reserved 0 of 12',
		);
		await expect(page.locator('#scheduleRow-slot-2')).toContainText(
			'Reserved 0 of 12',
		);
	});

	test('should save an edited schedule date as a time-slot update', async ({
		page,
	}) => {
		// Arrange
		const adminAccount = defaultAdminAccount();

		// Act
		await signInAdminViaUi(page, adminAccount);
		await navigateToScheduleEditorViaLanding(page);
		await fillIonicInput(page, '#slotDate-slot-1', '2025-12-13');
		await page.click('#saveTimeSlot-slot-1');

		// Assert
		await expect(page.locator('#scheduleEditorStatus')).toContainText(
			'Updated schedule time slot.',
		);
		await expect(page.locator('text=Saturday, Dec 13, 2025')).toBeVisible();
		await expect(page.locator('#scheduleRow-slot-1')).toContainText(
			'3AM - 4AM',
		);
	});
});
