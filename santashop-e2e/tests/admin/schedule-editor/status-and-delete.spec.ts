import { test, expect } from '../../../fixtures/test-fixtures';
import {
	clickIonToggle,
	confirmAlertButton,
	defaultAdminAccount,
	navigateToScheduleEditorViaLanding,
	scheduleSlot,
	signInAdminViaUi,
} from '../../../fixtures/admin-helpers';
import { e2eDateTime } from '../../../fixtures/season';

test.describe('admin schedule editor - status and delete', () => {
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
				scheduleSlot({
					id: 'slot-at-capacity',
					dateTime: e2eDateTime(12, 12, 10),
					maxSlots: 5,
					slotsReserved: 5,
				}),
				scheduleSlot({
					id: 'slot-over-capacity',
					dateTime: e2eDateTime(12, 12, 11),
					maxSlots: 5,
					slotsReserved: 7,
					enabled: false,
				}),
				scheduleSlot({
					id: 'slot-delete-me',
					dateTime: e2eDateTime(12, 12, 12),
					maxSlots: 8,
					slotsReserved: 2,
				}),
			]);
		},
	);

	test('should show capacity indicators and disabled styling', async ({
		page,
	}) => {
		// Arrange
		const adminAccount = defaultAdminAccount();

		// Act
		await signInAdminViaUi(page, adminAccount);
		await navigateToScheduleEditorViaLanding(page);

		// Assert
		await expect(
			page.locator('#scheduleRow-slot-at-capacity'),
		).toContainText('At capacity');
		await expect(
			page.locator('#scheduleRow-slot-over-capacity'),
		).toContainText('Over capacity');
		await expect(
			page.locator('#scheduleRow-slot-over-capacity'),
		).toContainText('Disabled');
		await expect(
			page.locator('#scheduleRow-slot-over-capacity'),
		).toHaveClass(/slot-card--disabled/);
	});

	test('should enable a disabled slot and delete a schedule row', async ({
		page,
	}) => {
		// Arrange
		const adminAccount = defaultAdminAccount();

		// Act
		await signInAdminViaUi(page, adminAccount);
		await navigateToScheduleEditorViaLanding(page);
		await clickIonToggle(page, '#slotEnabled-slot-over-capacity');
		await expect(page.locator('#scheduleEditorStatus')).toContainText(
			'Enabled 1 schedule.',
		);
		await expect(
			page.locator('#scheduleRow-slot-over-capacity'),
		).not.toHaveClass(/slot-row--disabled/);

		const deleteButton = page.locator('#deleteSchedule-slot-delete-me');
		await deleteButton.scrollIntoViewIfNeeded();
		await deleteButton.evaluate((element) => {
			(element as HTMLElement).click();
		});
		await confirmAlertButton(page, 'Delete');

		// Assert
		await expect(page.locator('#scheduleEditorStatus')).toContainText(
			'Schedule deleted.',
		);
		await expect(page.locator('#scheduleRow-slot-delete-me')).toHaveCount(
			0,
		);
	});
});
