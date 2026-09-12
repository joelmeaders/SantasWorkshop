import { test, expect } from '../../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	fillIonicInput,
	navigateToScheduleEditorViaLanding,
	scheduleSlot,
	signInAdminViaUi,
} from '../../../fixtures/admin-helpers';
import { e2eDate, e2eDateTime } from '../../../fixtures/season';

test.describe('schedule editor outside Denver', () => {
	test.use({ timezoneId: 'Asia/Tokyo' });

	test('SCHED-TZ-001 edits the Denver calendar date without shifting the hour', async ({
		page,
		clearData,
		seedPublicParams,
		seedAdminUser,
		seedDateTimeSlots,
	}) => {
		await clearData();
		await seedPublicParams({});
		const account = defaultAdminAccount();
		await seedAdminUser(account);
		await seedDateTimeSlots([
			scheduleSlot({
				id: 'denver-slot',
				dateTime: e2eDateTime(12, 12, 17),
			}),
		]);
		await signInAdminViaUi(page, account);
		await navigateToScheduleEditorViaLanding(page);
		const row = page.locator('#scheduleRow-denver-slot');
		await expect(row).toContainText('10:00 AM – 11:00 AM');
		await expect(page.locator('#slotDate-denver-slot input')).toHaveValue(
			e2eDate(12, 12),
		);
		await fillIonicInput(page, '#slotDate-denver-slot', e2eDate(12, 13));
		await page.locator('#saveTimeSlot-denver-slot').click();
		await expect(page.locator('#scheduleEditorStatus')).toContainText(
			'Updated schedule time slot.',
		);
		await page.reload();
		await expect(page.locator('#slotDate-denver-slot input')).toHaveValue(
			e2eDate(12, 13),
		);
		await expect(row).toContainText('10:00 AM – 11:00 AM');
	});
});
