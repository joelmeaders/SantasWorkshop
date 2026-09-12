import { test, expect } from '../../../fixtures/test-fixtures';
import {
	defaultOwnerAccount,
	fillIonicInput,
	navigateToScheduleEditorViaLanding,
	signInAdminViaUi,
} from '../../../fixtures/admin-helpers';
import {
	E2E_PROGRAM_YEAR,
	e2eDate,
	e2eDateTime,
	e2eDateLabel,
	e2eScheduleSlotId,
	e2eScheduleInitializationPhrase,
} from '../../../fixtures/season';

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
		await fillIonicInput(page, '#generateStartDate', e2eDate(12, 12));
		await fillIonicInput(page, '#generateEndDate', e2eDate(12, 12));
		await fillIonicInput(page, '#generateCapacity', '20');
		await page.click('#generateSchedulesButton');
		const alert = page.locator('ion-alert');
		await expect(alert).toBeVisible();
		await alert
			.getByRole('textbox', { name: 'Account password' })
			.fill(adminAccount.password);
		await alert
			.getByRole('textbox', {
				name: 'Exact confirmation phrase',
			})
			.fill(e2eScheduleInitializationPhrase());
		await alert.getByRole('button', { name: 'Initialize' }).click();

		// Assert
		await expect(
			page.getByText(e2eDateLabel(e2eDateTime(12, 12, 18), 'long'), {
				exact: false,
			}),
		).toBeVisible();
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
				id: e2eScheduleSlotId(e2eDateTime(12, 12, 18)),
				programYear: E2E_PROGRAM_YEAR,
				dateTime: e2eDateTime(12, 12, 18),
				maxSlots: 99,
				slotsReserved: 2,
			},
		]);
		const adminAccount = defaultOwnerAccount();
		await signInAdminViaUi(page, adminAccount);
		await navigateToScheduleEditorViaLanding(page);
		await fillIonicInput(page, '#generateStartDate', e2eDate(12, 12));
		await fillIonicInput(page, '#generateEndDate', e2eDate(12, 12));
		await fillIonicInput(page, '#generateCapacity', '20');
		await page.locator('#generateSchedulesButton').click();
		const alert = page.locator('ion-alert');
		await alert
			.getByRole('textbox', { name: 'Account password' })
			.fill(adminAccount.password);
		await alert
			.getByRole('textbox', { name: 'Exact confirmation phrase' })
			.fill(e2eScheduleInitializationPhrase());
		await alert.getByRole('button', { name: 'Initialize' }).click();

		await expect(
			page.getByText('Created 4 schedules and skipped 1 duplicates.'),
		).toBeVisible();
		await expect(page.locator('[id^="scheduleRow-"]')).toHaveCount(5);
		await expect(
			page.locator(
				`#scheduleRow-${e2eScheduleSlotId(e2eDateTime(12, 12, 18))}`,
			),
		).toContainText('Reserved 2 of 99');
	});
});
