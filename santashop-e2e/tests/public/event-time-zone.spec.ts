import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	randomAccount,
} from '../../fixtures/account-helpers';
import {
	addChildViaUi,
	defaultTestChild,
	editChildFirstNameViaUi,
	selectAppointmentViaUi,
	submitRegistrationViaUi,
} from '../../fixtures/registration-helpers';

import {
	E2E_PROGRAM_YEAR,
	e2eCalendarDateLabel,
	e2eDateTime,
} from '../../fixtures/season';

test.describe('appointment time zone', () => {
	test.use({ timezoneId: 'Asia/Tokyo' });

	test('APPT-TZ-001 keeps the Denver day and hour through selection and confirmation', async ({
		page,
		clearData,
		seedScenario,
		seedDateTimeSlots,
	}) => {
		await clearData();
		await seedScenario('create-account-enabled');
		await seedDateTimeSlots([
			{
				id: 'denver-late-slot',
				programYear: E2E_PROGRAM_YEAR,
				dateTime: e2eDateTime(12, 13, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		await createAccountViaUi(page, randomAccount());
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'denver-late-slot');
		const schedule = page.locator('app-schedule-card');
		await expect(schedule).toContainText(
			`December 12, ${E2E_PROGRAM_YEAR}`,
		);
		await expect(schedule).toContainText('5PM - 6PM');
		await submitRegistrationViaUi(page);
		await expect(page.locator('app-confirmation')).toContainText(
			'December 12,',
		);
		await expect(page.locator('app-confirmation')).toContainText(
			'5PM - 6PM',
		);
	});
});

test.describe('calendar birthday in a western time zone', () => {
	test.use({ timezoneId: 'America/Los_Angeles' });

	test('CHILD-TZ-001 keeps January 1 when reopening and saving a child', async ({
		page,
		clearData,
		seedScenario,
	}) => {
		await clearData();
		await seedScenario('create-account-enabled');
		await createAccountViaUi(page, randomAccount());
		const child = defaultTestChild({
			dateOfBirth: `${E2E_PROGRAM_YEAR - 11}-01-01`,
		});
		await addChildViaUi(page, child);
		await page.reload();
		await editChildFirstNameViaUi(
			page,
			`${child.firstName} ${child.lastName}`,
			'Comet',
		);
		await page.reload();
		const row = page
			.locator('app-children-card ion-item')
			.filter({ hasText: `Comet ${child.lastName}` });
		await expect(row).toContainText(
			e2eCalendarDateLabel(1, 1, E2E_PROGRAM_YEAR - 11),
		);
	});
});
