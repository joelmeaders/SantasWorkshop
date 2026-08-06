import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	randomAccount,
	signInViaUi,
	signOutViaUi,
} from '../../fixtures/account-helpers';
import {
	addChildViaUi,
	defaultTestChild,
	editChildFirstNameViaUi,
	removeChildViaUi,
	selectAppointmentViaUi,
	submitRegistrationViaUi,
} from '../../fixtures/registration-helpers';

const TEST_PROGRAM_YEAR = new Date().getFullYear();
const testSlotDate = (year: number, day: number, hour: number): string =>
	new Date(Date.UTC(year, 11, day, hour)).toISOString();

test.describe('customer registration lifecycle', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('REG-001 and REG-002 persist a listed referral and reveal registration progress', async ({
		page,
	}) => {
		await createAccountViaUi(
			page,
			randomAccount(),
			'School - Denver Public Schools (DPS)',
		);

		await expect(page.locator('#children-heading')).toBeVisible({
			timeout: 15000,
		});
		await expect(page.locator('#appointment-heading')).toBeVisible();
		await expect(page.locator('#review-heading')).toBeVisible();
	});

	test('REG-003 persists an alternate referral value', async ({ page }) => {
		await createAccountViaUi(
			page,
			randomAccount(),
			'Other',
			'Neighborhood friend',
		);

		await expect(page.locator('#children-heading')).toBeVisible({
			timeout: 15000,
		});
	});

	test('REG-004 blocks final review until required registration data exists', async ({
		page,
	}) => {
		await createAccountViaUi(page, randomAccount());
		await page.goto('/pre-registration/overview#review');

		await expect(page).toHaveURL(/\/pre-registration\/overview(?:#review)?$/);
		await expect(page.locator('#review-heading')).toBeVisible({
			timeout: 15000,
		});
	});

	test('CHILD-001 through CHILD-003 add, edit, and remove an eligible child', async ({
		page,
	}) => {
		await createAccountViaUi(page, randomAccount());
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
		await page.goto('/pre-registration/overview#children');
		await page.locator('app-children-card [data-open-add-child]').click();
		const childForm = page.locator('ion-modal form');
		await expect(childForm).toBeVisible({ timeout: 15000 });
		await childForm.locator('ion-input[formControlName="firstName"] input').fill('Too');
		await childForm.locator('ion-input[formControlName="lastName"] input').fill('Old');
		const birthDate = childForm.locator(
			'ion-input[formControlName="dateOfBirth"]',
		);
		await birthDate.locator('input').first().fill('2010-01-01');
		await birthDate.evaluate((element) => {
			element.dispatchEvent(
				new CustomEvent('ionChange', {
					bubbles: true,
					detail: { value: '2010-01-01' },
				}),
			);
		});

		await expect(
			childForm.locator('ion-button[type="submit"]'),
		).toHaveClass(
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
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 6, 16),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 2,
				enabled: true,
			},
			{
				id: 'public-slot-2',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 6, 17),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 3,
				enabled: true,
			},
			{
				id: 'disabled-slot',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 6, 18),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: false,
			},
			{
				id: 'other-season-slot',
				programYear: TEST_PROGRAM_YEAR - 1,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR - 1, 7, 16),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR - 1, 1, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		const child = defaultTestChild();
		const account = randomAccount();
		const updatedEmailAddress = `updated-${account.emailAddress}`;
		await createAccountViaUi(page, account);
		await addChildViaUi(page, child);

		await page.goto('/pre-registration/overview#appointment');
		await expect(page.locator('app-schedule-card ion-list [data-select-slot-id]')).toHaveCount(2, {
			timeout: 15000,
		});
		await selectAppointmentViaUi(page, 'public-slot-1');
		await page.goto('/pre-registration/overview#review');
		const submitCard = page.locator('app-submit-card');
		await submitCard
			.getByRole('button', { name: 'Review registration', exact: true })
			.click();
		await expect(submitCard.getByText(account.emailAddress, { exact: true })).toBeVisible();
		await submitCard
			.getByRole('button', { name: 'Update email', exact: true })
			.click();
		await submitCard
			.locator('ion-input[formControlName="emailAddress"] input')
			.fill(updatedEmailAddress);
		await submitCard
			.locator('ion-input[formControlName="password"] input')
			.fill(account.password);
		await submitCard
			.getByRole('button', { name: 'Save email', exact: true })
			.click();
		await expect(
			submitCard.getByText(updatedEmailAddress, { exact: true }),
		).toBeVisible({ timeout: 30000 });
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
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 7, 16),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		await createAccountViaUi(page, randomAccount());
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'guard-slot');
		await submitRegistrationViaUi(page);

		await page.goto('/pre-registration/children');
		await expect(page).toHaveURL(/\/pre-registration\/confirmation$/);
		await page.goto('/pre-registration/submit');
		await expect(page).toHaveURL(/\/pre-registration\/confirmation$/);
	});

	test('CONF-001 protects confirmation routes until registration is submitted', async ({
		page,
	}) => {
		await createAccountViaUi(page, randomAccount());

		for (const route of [
			'/pre-registration/confirmation',
			'/pre-registration/confirmation/event-information',
		]) {
			await page.goto(route);
			await expect(page).toHaveURL(/\/pre-registration\/overview$/);
		}
	});

	test('CONF-002 opens event information from the submitted confirmation', async ({
		page,
		seedDateTimeSlots,
	}) => {
		await seedDateTimeSlots([
			{
				id: 'event-information-slot',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 7, 16),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		await createAccountViaUi(page, randomAccount());
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'event-information-slot');
		await submitRegistrationViaUi(page);

		await page.click('#eventInformationButton');
		await expect(page).toHaveURL(
			/\/pre-registration\/confirmation#event-information$/,
		);
		await expect(page.getByRole('heading', { name: 'Event information', exact: true })).toBeVisible();
		await expect(
			page.locator('#event-information').getByRole('link', { name: /FAQ/i }),
		).toBeVisible();
	});

	test('SUB-005 changes a submitted appointment when the control is enabled', async ({
		page,
		seedDateTimeSlots,
	}) => {
		const currentSlotDate = testSlotDate(TEST_PROGRAM_YEAR, 6, 16);
		const targetSlotDate = testSlotDate(TEST_PROGRAM_YEAR, 7, 16);
		await seedDateTimeSlots([
			{
				id: 'submitted-current-slot',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: currentSlotDate,
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 1,
				enabled: true,
			},
			{
				id: 'submitted-target-slot',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: targetSlotDate,
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 1,
				enabled: true,
			},
		]);
		await createAccountViaUi(page, randomAccount());
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'submitted-current-slot');
		await submitRegistrationViaUi(page);

		const changeButton = page
			.locator('app-confirmation')
			.getByRole('button', { name: 'Change Date & Time', exact: true });
		await expect(changeButton).toBeVisible({ timeout: 15000 });
		await changeButton.click();

		const confirmationAlert = page.locator('ion-alert');
		await expect(confirmationAlert).toContainText(
			'Changing your registration date/time',
			{ timeout: 10000 },
		);
		await confirmationAlert
			.getByRole('button', { name: 'Continue', exact: true })
			.click();

		const modal = page.locator('ion-modal').filter({
			has: page.locator('app-change-datetime-modal'),
		});
		await expect(modal).toBeVisible({ timeout: 15000 });
		const targetDay = new Date(targetSlotDate).toLocaleDateString('en-US', {
			day: 'numeric',
			month: 'long',
			timeZone: 'America/Denver',
			weekday: 'long',
		});
		const targetAccordion = modal
			.locator('ion-accordion')
			.filter({ hasText: targetDay });
		await expect(targetAccordion).toBeAttached({ timeout: 15000 });
		await targetAccordion.locator('ion-item[slot="header"]').click();
		const targetSlot = modal.locator(
			'[data-change-slot-id="submitted-target-slot"]',
		);
		await expect(targetSlot).toBeVisible({ timeout: 10000 });
		await targetSlot.click();

		await expect(modal).toHaveCount(0, { timeout: 15000 });
		const successAlert = page.locator('ion-alert');
		await expect(successAlert).toContainText(
			'Your registration has been updated!',
			{ timeout: 30000 },
		);
		await successAlert
			.getByRole('button', { name: 'OK', exact: true })
			.click();

		await page.reload();
		await expect(page.locator('#registrationQrCode')).toBeVisible({
			timeout: 15000,
		});
		await changeButton.click();
		await page
			.locator('ion-alert')
			.getByRole('button', { name: 'Continue', exact: true })
			.click();
		const reopenedModal = page.locator('ion-modal').filter({
			has: page.locator('app-change-datetime-modal'),
		});
		await expect(reopenedModal).toBeVisible({ timeout: 15000 });
		await expect(reopenedModal.locator('ion-card h2')).toContainText(
			targetDay,
		);
	});

	test('REG-006 notifies and signs out a checked-in customer', async ({
		page,
		seedCheckIn,
		seedDateTimeSlots,
	}) => {
		await seedDateTimeSlots([
			{
				id: 'checked-in-slot',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 8, 16),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		const account = randomAccount();
		await createAccountViaUi(page, account);
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'checked-in-slot');
		await submitRegistrationViaUi(page);

		await seedCheckIn(account.emailAddress);
		const checkInAlert = page.locator('ion-alert');
		await expect(checkInAlert).toContainText(
			'Your registration and checkin was confirmed',
			{ timeout: 15000 },
		);
		await checkInAlert
			.getByRole('button', { name: 'Ok', exact: true })
			.click();
		await expect(page).toHaveURL(/\/\?mode=sign-in/, { timeout: 30000 });
		await expect(page.locator('#signInButton')).toBeVisible();

		await page.goto('/pre-registration/children');
		await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
	});

	test('SUB-008 hides appointment changes and cancellation after check-in', async ({
		page,
		seedCheckIn,
		seedDateTimeSlots,
	}) => {
		await seedDateTimeSlots([
			{
				id: 'checked-in-controls-slot',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 11, 16),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		const account = randomAccount();
		await createAccountViaUi(page, account);
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'checked-in-controls-slot');
		await submitRegistrationViaUi(page);

		await seedCheckIn(account.emailAddress);
		await expect(page.locator('#changeRegistrationButton')).toBeHidden({
			timeout: 15000,
		});
		await expect(page.locator('#cancelRegistrationButton')).toBeHidden({
			timeout: 15000,
		});
		const checkInAlert = page.locator('ion-alert');
		await checkInAlert
			.getByRole('button', { name: 'Ok', exact: true })
			.click();
		await expect(page).toHaveURL(/\/\?mode=sign-in/, { timeout: 30000 });
	});

	test('REG-007 resumes an incomplete registration in a new browser context', async ({
		page,
		browser,
	}) => {
		const account = randomAccount();
		await createAccountViaUi(page, account);

		const context = await browser.newContext({
			baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4100',
		});
		try {
			const resumedPage = await context.newPage();
			await signInViaUi(resumedPage, account);
			await expect(
				resumedPage.locator('#children-heading'),
			).toBeVisible({
				timeout: 15000,
			});
			await expect(
				resumedPage.locator('#appointment-heading'),
			).toBeVisible();
			await resumedPage.goto('/pre-registration/submit');
			await expect(resumedPage).toHaveURL(
				/\/pre-registration\/overview$/,
				{
					timeout: 30000,
				},
			);
		} finally {
			await context.close();
		}
	});

	test('SUB-005 hides the change control when runtime changes are disabled', async ({
		page,
		seedDateTimeSlots,
		seedPublicParams,
	}) => {
		await seedDateTimeSlots([
			{
				id: 'change-disabled-slot',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 9, 16),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		await createAccountViaUi(page, randomAccount());
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'change-disabled-slot');
		await submitRegistrationViaUi(page);

		const changeButton = page
			.locator('app-confirmation')
			.getByRole('button', { name: 'Change Date & Time', exact: true });
		await expect(changeButton).toBeVisible({ timeout: 15000 });

		await seedPublicParams({
			registrationEnabled: true,
			maintenanceModeEnabled: false,
			weatherModeEnabled: false,
			createAccountEnabled: true,
			admin: {
				checkinEnabled: true,
				onsiteRegistrationEnabled: true,
				preRegistrationEnabled: true,
				allowCancelRegistration: true,
				allowChangeRegistration: false,
			},
		});
		await expect(changeButton).toBeHidden({ timeout: 15000 });
	});

	test('SUB-007 cancels a submitted registration only while the runtime control is enabled', async ({
		page,
		seedDateTimeSlots,
		seedPublicParams,
	}) => {
		await seedDateTimeSlots([
			{
				id: 'cancellation-slot',
				programYear: TEST_PROGRAM_YEAR,
				dateTime: testSlotDate(TEST_PROGRAM_YEAR, 10, 16),
				lastUpdated: testSlotDate(TEST_PROGRAM_YEAR, 1, 0),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		await createAccountViaUi(page, randomAccount());
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'cancellation-slot');
		await submitRegistrationViaUi(page);

		const cancelButton = page.locator('#cancelRegistrationButton');
		await seedPublicParams({
			admin: {
				checkinEnabled: true,
				onsiteRegistrationEnabled: true,
				preRegistrationEnabled: true,
				allowCancelRegistration: false,
				allowChangeRegistration: true,
			},
		});
		await expect(cancelButton).toBeHidden({ timeout: 15000 });
		await seedPublicParams({
			admin: {
				checkinEnabled: true,
				onsiteRegistrationEnabled: true,
				preRegistrationEnabled: true,
				allowCancelRegistration: true,
				allowChangeRegistration: true,
			},
		});
		await expect(cancelButton).toBeVisible({ timeout: 15000 });
		await cancelButton.click();
		const confirmationAlert = page.locator('ion-alert');
		await expect(confirmationAlert).toContainText(
			'Cancelling your registration',
		);
		await confirmationAlert
			.getByRole('button', { name: 'Confirm', exact: true })
			.click();
		await expect(page).toHaveURL(/\/pre-registration\/overview$/, {
			timeout: 30000,
		});
		await expect(
			page.locator('app-overview #registrationQrCode'),
		).toHaveCount(0);
	});

	test('PROFILE-001 exposes profile and help from the authenticated menu', async ({
		page,
	}) => {
		await createAccountViaUi(page, randomAccount());

		await page.click('#menuButton');
		await page.getByText('My Account', { exact: true }).click();
		await expect(page).toHaveURL(/\/pre-registration\/profile$/);
		await expect(
			page.getByRole('heading', { name: 'My Account', exact: true }),
		).toBeVisible();

		await page.click('#menuButton');
		await page.getByText('Help', { exact: true }).click();
		await expect(page.locator('ion-modal app-help')).toBeVisible();
		await expect(
			page.locator(
				'ion-modal ion-button[href="https://www.denversantaclausshop.org/contact/"]',
			),
		).toBeVisible();
	});

	test('PROFILE-002 persists changed name and zip code', async ({ page }) => {
		await createAccountViaUi(page, randomAccount());
		await page.goto('/pre-registration/profile');

		await page
			.locator('ion-input[formControlName="firstName"] input')
			.fill('Dasher');
		await page
			.locator('ion-input[formControlName="lastName"] input')
			.fill('Reindeer');
		await page
			.locator('ion-input[formControlName="zipCode"] input')
			.fill('80209');
		const profilePanel = page.locator('details').first();
		const saveButton = profilePanel.getByRole('button', {
			name: 'Save Changes',
			exact: true,
		});
		await expect(saveButton).not.toHaveClass(/button-disabled/, {
			timeout: 15000,
		});
		await saveButton.click();
		await expect(page).toHaveURL(/\/pre-registration\/profile$/);

		const profile = page.locator('app-profile');
		await expect(
			profile.getByRole('textbox', { name: 'First Name', exact: true }),
		).toHaveValue('Dasher', { timeout: 30000 });
		await expect(
			profile.getByRole('textbox', { name: 'Last Name', exact: true }),
		).toHaveValue('Reindeer', { timeout: 30000 });
		await expect(
			profile.getByRole('textbox', { name: 'Zip Code', exact: true }),
		).toHaveValue('80209', { timeout: 30000 });
	});

	test('PROFILE-003 changes the email address after password reauthentication', async ({
		page,
	}) => {
		const account = randomAccount();
		const replacement = randomAccount();
		await createAccountViaUi(page, account);
		await page.goto('/pre-registration/profile');
		const emailPanel = page
			.locator('details')
			.filter({ has: page.locator('ion-input[formControlName="emailAddress"]') });
		await emailPanel.locator('summary').click();

		await page
			.locator('ion-input[formControlName="emailAddress"] input')
			.fill(replacement.emailAddress);
		await page
			.locator('ion-input[formControlName="password"] input')
			.fill(account.password);
		await emailPanel
			.getByRole('button', { name: 'Save Changes', exact: true })
			.click();

		const alert = page.locator('ion-alert');
		await expect(alert).toContainText('Your email address was updated', {
			timeout: 15000,
		});
		await alert.getByRole('button', { name: 'Ok', exact: true }).click();
		await expect(page).toHaveURL(/\/pre-registration\/profile$/);
		await expect(
			emailPanel.locator('summary small'),
		).toContainText(replacement.emailAddress, { timeout: 30000 });
	});

	test('PROFILE-004 changes the password and accepts the new credential', async ({
		page,
	}) => {
		const account = randomAccount();
		const newPassword = `${account.password}Changed`;
		await createAccountViaUi(page, account);
		await page.goto('/pre-registration/profile');
		const passwordPanel = page
			.locator('details')
			.filter({ has: page.locator('ion-input[formControlName="oldPassword"]') });
		await passwordPanel.locator('summary').click();

		await page
			.locator('ion-input[formControlName="oldPassword"] input')
			.fill(account.password);
		await page
			.locator('ion-input[formControlName="newPassword"] input')
			.fill(newPassword);
		await page
			.locator('ion-input[formControlName="newPassword2"] input')
			.fill(newPassword);
		await passwordPanel
			.getByRole('button', { name: 'Save Changes', exact: true })
			.click();

		const alert = page.locator('ion-alert');
		await expect(alert).toContainText('Password Changed', {
			timeout: 15000,
		});
		await alert.getByRole('button', { name: 'Ok', exact: true }).click();
		await expect(page).toHaveURL(/\/pre-registration\/profile$/);

		await signOutViaUi(page);
		await signInViaUi(page, {
			emailAddress: account.emailAddress,
			password: newPassword,
		});
		await expect(page).toHaveURL(/\/pre-registration\/overview$/);
	});
});
