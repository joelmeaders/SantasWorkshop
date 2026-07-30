import { test, expect } from '../../fixtures/test-fixtures';
import {
	completeReferralViaUi,
	createAccountViaUi,
	randomAccount,
} from '../../fixtures/account-helpers';
import {
	addChildViaUi,
	defaultTestChild,
	editChildFirstNameViaUi,
	removeChildViaUi,
	selectAppointmentViaUi,
	submitRegistrationViaUi,
} from '../../fixtures/registration-helpers';

test.describe('customer registration lifecycle', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('REG-001 and REG-002 persist a listed referral and reveal registration progress', async ({
		page,
	}) => {
		await createAccountViaUi(page, randomAccount());
		await page.fill('#referralSearchbar input', 'SCHOOL');
		const referral = page.locator(
			'#referral-School\\ -\\ Denver\\ Public\\ Schools\\ \\(DPS\\)',
		);
		await expect(referral).toBeVisible({ timeout: 10000 });
		await referral.click();
		await page.click('#saveReferralButton');

		await expect(page.locator('#childrenProgressCard')).toBeVisible({
			timeout: 15000,
		});
		await expect(page.locator('#scheduleProgressCard')).toBeVisible();
		await expect(page.locator('#submitProgressCard')).toBeVisible();
	});

	test('REG-003 persists an alternate referral value', async ({ page }) => {
		await createAccountViaUi(page, randomAccount());
		await page.click('#referral-Other');
		await page.fill('#referralOther input', 'Neighborhood friend');
		await page.click('#saveReferralButton');

		await expect(page.locator('#childrenProgressCard')).toBeVisible({
			timeout: 15000,
		});
	});

	test('REG-004 blocks final review until required registration data exists', async ({
		page,
	}) => {
		await createAccountViaUi(page, randomAccount());
		await completeReferralViaUi(page);
		await page.goto('/pre-registration/submit');

		await expect(page).toHaveURL(/\/pre-registration\/overview$/);
		await expect(page.locator('#submitProgressCard')).toBeVisible({
			timeout: 15000,
		});
	});

	test('CHILD-001 through CHILD-003 add, edit, and remove an eligible child', async ({
		page,
	}) => {
		await createAccountViaUi(page, randomAccount());
		await completeReferralViaUi(page);
		const child = defaultTestChild();

		await addChildViaUi(page, child);
		await editChildFirstNameViaUi(
			page,
			`${child.firstName} ${child.lastName}`,
			'Dasher',
		);
		await expect(
			page.getByText(`Dasher ${child.lastName}`, { exact: true }),
		).toBeVisible({ timeout: 15000 });
		await removeChildViaUi(page, `Dasher ${child.lastName}`);
	});

	test('CHILD-004 rejects an ineligible birth date', async ({ page }) => {
		await createAccountViaUi(page, randomAccount());
		await completeReferralViaUi(page);
		await page.goto('/pre-registration/children/add-child');
		await page.fill('#childFirstName input', 'Too');
		await page.fill('#childLastName input', 'Old');
		const birthDate = page.locator('#childDateOfBirth');
		await birthDate.locator('input').first().fill('2010-01-01');

		await expect(page.locator('ion-alert').last()).toBeVisible({
			timeout: 10000,
		});
		await expect(page.locator('#saveChildButton')).toHaveClass(
			/button-disabled/,
		);
	});

	test('APPT-001 through SUB-002 complete a valid reservation and show confirmation', async ({
		page,
		seedDateTimeSlots,
	}) => {
		await seedDateTimeSlots([
			{
				id: 'public-slot-1',
				programYear: 2025,
				dateTime: '2025-12-06T16:00:00.000Z',
				maxSlots: 10,
				slotsReserved: 2,
				enabled: true,
			},
			{
				id: 'public-slot-2',
				programYear: 2025,
				dateTime: '2025-12-06T17:00:00.000Z',
				maxSlots: 10,
				slotsReserved: 3,
				enabled: true,
			},
			{
				id: 'disabled-slot',
				programYear: 2025,
				dateTime: '2025-12-06T18:00:00.000Z',
				maxSlots: 10,
				slotsReserved: 0,
				enabled: false,
			},
			{
				id: 'other-season-slot',
				programYear: 2024,
				dateTime: '2024-12-07T16:00:00.000Z',
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		const child = defaultTestChild();
		await createAccountViaUi(page, randomAccount());
		await completeReferralViaUi(page);
		await addChildViaUi(page, child);

		await page.goto('/pre-registration/date-time');
		await expect(
			page.locator('[data-select-slot-id="public-slot-1"]'),
		).toBeAttached({ timeout: 15000 });
		await expect(
			page.locator('[data-select-slot-id="disabled-slot"]'),
		).toHaveCount(0);
		await expect(
			page.locator('[data-select-slot-id="other-season-slot"]'),
		).toHaveCount(0);
		await selectAppointmentViaUi(page, 'public-slot-1');

		await page.goto('/pre-registration/date-time');
		await page.locator('[data-selected-slot-id="public-slot-1"]').click();
		const changeAlert = page.locator('ion-alert');
		await expect(changeAlert).toBeVisible({ timeout: 10000 });
		await changeAlert.getByRole('button', { name: 'Continue' }).click();
		await expect(
			page.locator('[data-selected-slot-id="public-slot-1"]'),
		).toHaveCount(0, { timeout: 15000 });
		await expect(
			page.locator('[data-select-slot-id="public-slot-2"]'),
		).toBeAttached({ timeout: 15000 });
		// The cancellation UI updates before the registration write settles.
		// Prove the cleared choice survives a route transition before replacing it.
		await page.waitForTimeout(1000);
		await page.goto('/pre-registration/overview');
		await expect(page.locator('#scheduleProgressCard')).not.toContainText(
			'Complete',
			{ timeout: 15000 },
		);
		await selectAppointmentViaUi(page, 'public-slot-2');
		await submitRegistrationViaUi(page);

		await expect(page.locator('#registrationQrCode')).toHaveAttribute(
			'alt',
			'Registration QR Code',
		);
		await expect(
			page
				.locator('app-confirmation')
				.getByText(`${child.firstName} ${child.lastName}`, {
					exact: true,
				}),
		).toBeVisible();
		await expect(page.locator('#eventInformationButton')).toBeVisible();
	});

	test('REG-005 and SUB-004 keep a submitted registration out of draft routes', async ({
		page,
		seedDateTimeSlots,
	}) => {
		await seedDateTimeSlots([
			{
				id: 'guard-slot',
				programYear: 2025,
				dateTime: '2025-12-07T16:00:00.000Z',
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		await createAccountViaUi(page, randomAccount());
		await completeReferralViaUi(page);
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'guard-slot');
		await submitRegistrationViaUi(page);

		await page.goto('/pre-registration/children');
		await expect(page).toHaveURL(/\/pre-registration\/confirmation$/);
		await page.goto('/pre-registration/submit');
		await expect(page).toHaveURL(/\/pre-registration\/confirmation$/);
	});
});
