import { test, expect } from '../fixtures/test-fixtures';
import {
	completeReferralViaUi,
	createAccountViaUi,
	fillCreateAccountForm,
	randomAccount,
	signOutViaUi,
} from '../fixtures/account-helpers';

/**
 * E2E tests for the Create Account flow
 *
 * Tests the complete user journey:
 * 1. Click Create Account
 * 2. Fill out the registration form
 * 3. Submit/confirm email
 * 4. Select referral source
 * 5. Verify automatic login
 */

test.describe('Create Account Flow', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('should successfully create an account and auto-login', async ({
		page,
	}) => {
		const account = randomAccount();

		await createAccountViaUi(page, account);

		expect(page.url()).toContain('/pre-registration/overview');
		await expect(page.locator('app-referral-card')).toBeVisible({
			timeout: 10000,
		});
	});

	test('should allow user to select referral source after account creation', async ({
		page,
	}) => {
		const account = randomAccount();

		await createAccountViaUi(page, account);

		await expect(page.locator('app-referral-card')).toBeVisible({
			timeout: 10000,
		});

		const searchbar = page.locator('#referralSearchbar input');
		await searchbar.fill('SCHOOL');

		const dpsReferral = page.locator(
			'#referral-School\\ -\\ Denver\\ Public\\ Schools\\ \\(DPS\\)',
		);
		await expect(dpsReferral).toBeVisible({ timeout: 10000 });
		await dpsReferral.click();

		await expect(page.locator('app-referral-card ion-text')).toContainText(
			'School - Denver Public Schools (DPS)',
		);

		await page.click('#saveReferralButton');
		await expect(page.locator('app-children-card')).toBeVisible({
			timeout: 10000,
		});
	});

	test('should handle "Other" referral option correctly', async ({
		page,
	}) => {
		const account = randomAccount();

		await createAccountViaUi(page, account);

		await page.click('#referral-Other');
		await page.fill('#referralOther input', 'Friend');
		await expect(page.locator('app-referral-card ion-text')).toContainText(
			'Other',
		);
		const otherSaveButton = page.locator('#saveReferralButton');
		await expect(otherSaveButton).not.toHaveClass(/button-disabled/, {
			timeout: 10000,
		});
		await otherSaveButton.click();
		await expect(page.locator('app-children-card')).toBeVisible({
			timeout: 10000,
		});
	});

	test('should show error when account already exists', async ({ page }) => {
		const existingAccount = randomAccount();

		await createAccountViaUi(page, existingAccount);
		await completeReferralViaUi(page);
		await signOutViaUi(page);

		const duplicateAccount = {
			...randomAccount(),
			emailAddress: existingAccount.emailAddress,
		};

		await page.goto('/sign-up');
		await fillCreateAccountForm(page, duplicateAccount);
		await page.click('#legalCheckbox');
		await expect(page.locator('#submitButton')).not.toHaveClass(
			/button-disabled/,
			{ timeout: 15000 },
		);
		await page.click('#submitButton');
		await page.click('ion-alert button.alert-button-role-confirm');

		const duplicateAccountAlert = page.locator('ion-alert');
		await expect(duplicateAccountAlert).toContainText(/account/i, {
			timeout: 10000,
		});
		await expect(duplicateAccountAlert).toContainText(
			existingAccount.emailAddress,
		);
	});

	test('should validate required form fields', async ({ page }) => {
		const account = randomAccount();

		await page.goto('/sign-up');

		const submitButton = page.locator('#submitButton');
		await expect(submitButton).toHaveClass(/button-disabled/);

		await page.fill('#emailAddress input', account.emailAddress);
		await expect(submitButton).toHaveClass(/button-disabled/);

		await page.fill('#firstName input', account.firstName);
		await page.fill('#lastName input', account.lastName);
		await page.fill('#zipCode input', account.zipCode);
		await page.fill('#password input', account.password);
		await page.fill('#password2 input', account.password);

		await expect(submitButton).toHaveClass(/button-disabled/);

		await page.click('#legalCheckbox');
		await expect(submitButton).not.toHaveClass(/button-disabled/, {
			timeout: 15000,
		});
	});

	test('should not show Create Account button when disabled', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('create-account-disabled');
		await page.goto('/sign-in');

		const createAccountButton = page.locator('#createAccountButton');
		await expect(createAccountButton).toBeHidden();

		await page.goto('/sign-up');
		await expect(page.locator('.alert p')).toBeVisible();
		await expect(page.locator('#submitButton')).toHaveCount(0);
	});

	test('should show registration closed modal when registration is disabled', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('registration-closed');
		await page.goto('/');

		// Should show registration closed modal
		await expect(page.locator('app-registration-closed')).toBeVisible({
			timeout: 5000,
		});
	});
});

test.describe('Create Account Flow - Maintenance Mode', () => {
	test('should show maintenance modal when maintenance mode enabled', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('maintenance-mode');
		await page.goto('/');

		// Should show maintenance modal
		await expect(page.locator('app-maintenance')).toBeVisible({
			timeout: 5000,
		});
	});
});

test.describe('Create Account Flow - Weather Mode', () => {
	test('should show bad weather modal when weather mode enabled', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('weather-mode');
		await page.goto('/');

		// Should show bad weather modal
		await expect(page.locator('app-bad-weather')).toBeVisible({
			timeout: 5000,
		});
	});
});
