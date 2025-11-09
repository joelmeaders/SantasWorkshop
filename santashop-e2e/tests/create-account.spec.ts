import { test, expect } from '../fixtures/test-fixtures';

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
	// Clear data before each test
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('should successfully create an account and auto-login', async ({
		page,
		seedScenario,
	}) => {
		// Setup: Ensure create account is enabled
		await seedScenario('create-account-enabled');

		// Navigate to the sign-up page
		await page.goto('/sign-up');

		// Fill out the form
		await page.fill('#firstName input', 'John');
		await page.fill('#lastName input', 'Doe');
		await page.fill('#zipCode input', '80203');
		await page.fill('#emailAddress input', 'john.doe@test.com');
		await page.fill('#password input', 'TestPassword123!');
		await page.fill('#password2 input', 'TestPassword123!');

		// Accept legal checkbox
		await page.click('#legalCheckbox');

		// Submit the form
		await page.click('#submitButton');

		// Confirm email in the alert
		await page.waitForSelector('ion-alert', { timeout: 5000 });
		await page.click('ion-alert button.alert-button:not([role="cancel"])');

		// Wait for account creation and auto-login
		// Should redirect to pre-registration overview page
		// Wait for either the URL change or the referral card to appear
		try {
			await Promise.race([
				page.waitForURL('**/pre-registration/overview', {
					timeout: 30000,
				}),
				page
					.locator('app-referral-card')
					.waitFor({ state: 'visible', timeout: 30000 }),
			]);
		} catch (error) {
			// Log current URL for debugging
			console.log('Current URL:', page.url());
			throw error;
		}

		// Verify we're on the overview page
		expect(page.url()).toContain('/pre-registration/overview');

		// Verify referral card is visible (user hasn't selected yet)
		await expect(page.locator('app-referral-card')).toBeVisible({
			timeout: 10000,
		});
	});

	test('should allow user to select referral source after account creation', async ({
		page,
		seedScenario,
	}) => {
		// Setup
		await seedScenario('create-account-enabled');
		await page.goto('/sign-in');

		// Create account
		await page.click('#createAccountButton');
		await page.waitForURL('**/sign-up');
		await page.fill('#firstName input', 'Jane');
		await page.fill('#lastName input', 'Smith');
		await page.fill('#zipCode input', '80204');
		await page.fill('#emailAddress input', 'jane.smith@test.com');
		await page.fill('#password input', 'TestPassword123!');
		await page.fill('#password2 input', 'TestPassword123!');
		await page.click('#legalCheckbox');
		await page.click('#submitButton');
		await page.waitForSelector('ion-alert', { timeout: 5000 });
		await page.click('ion-alert button.alert-button:not([role="cancel"])');

		// Wait for overview page
		await page.waitForURL('**/pre-registration/overview', {
			timeout: 30000,
			waitUntil: 'networkidle',
		});

		// Select a referral source
		await expect(page.locator('app-referral-card')).toBeVisible({
			timeout: 10000,
		});

		// Type in search to filter referrals
		const searchbar = page.locator('#referralSearchbar input');
		await searchbar.fill('SCHOOL');

		// Select a referral option (wait for filtered list)
		await page.waitForTimeout(500);
		await page.click(
			'#referral-School\\ -\\ Denver\\ Public\\ Schools\\ \\(DPS\\)',
		);

		// Verify the selection is shown
		await expect(page.locator('app-referral-card ion-text')).toContainText(
			'School - Denver Public Schools (DPS)',
		);

		// Submit referral
		await page.click('#saveReferralButton');

		// Wait for loading to complete
		await page.waitForTimeout(3000);
	});

	test('should handle "Other" referral option correctly', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('create-account-enabled');
		await page.goto('/sign-in');

		// Create account
		await page.click('#createAccountButton');
		await page.waitForURL('**/sign-up');
		await page.fill('#firstName input', 'Bob');
		await page.fill('#lastName input', 'Johnson');
		await page.fill('#zipCode input', '80205');
		await page.fill('#emailAddress input', 'bob.johnson@test.com');
		await page.fill('#password input', 'TestPassword123!');
		await page.fill('#password2 input', 'TestPassword123!');
		await page.click('#legalCheckbox');
		await page.click('#submitButton');
		await page.waitForSelector('ion-alert', { timeout: 5000 });
		await page.click('ion-alert button.alert-button:not([role="cancel"])');
		await page.waitForURL('**/pre-registration/overview', {
			timeout: 30000,
			waitUntil: 'networkidle',
		});

		// Select "Other" option
		await page.click('#referral-Other');

		// Fill in the custom referral text
		await page.fill('#referralOther input', 'Friend');

		// Submit
		await page.click('#saveReferralButton');
		await page.waitForTimeout(3000);

		// Verify the custom referral was saved
		await expect(page.locator('app-referral-card')).toContainText('Other');
	});

	test('should show error when account already exists', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('create-account-enabled');
		await page.goto('/sign-in');

		// Create first account
		await page.click('#createAccountButton');
		await page.waitForURL('**/sign-up');
		const email = 'duplicate@test.com';
		await page.fill('#firstName input', 'First');
		await page.fill('#lastName input', 'User');
		await page.fill('#zipCode input', '80206');
		await page.fill('#emailAddress input', email);
		await page.fill('#password input', 'TestPassword123!');
		await page.fill('#password2 input', 'TestPassword123!');
		await page.click('#legalCheckbox');
		await page.click('#submitButton');
		await page.waitForSelector('ion-alert', { timeout: 5000 });
		await page.click('ion-alert button.alert-button:not([role="cancel"])');
		await page.waitForURL('**/pre-registration/overview', {
			timeout: 30000,
			waitUntil: 'networkidle',
		});

		// Navigate back to sign-in
		await page.goto('/sign-in');

		// Try to create account with same email
		await page.click('#createAccountButton');
		await page.waitForURL('**/sign-up');
		await page.fill('#firstName input', 'Second');
		await page.fill('#lastName input', 'User');
		await page.fill('#zipCode input', '80207');
		await page.fill('#emailAddress input', email);
		await page.fill('#password input', 'TestPassword456!');
		await page.fill('#password2 input', 'TestPassword456!');
		await page.click('#legalCheckbox');
		await page.click('#submitButton');
		await page.waitForSelector('ion-alert', { timeout: 5000 });
		await page.click('ion-alert button.alert-button:not([role="cancel"])');

		// Should show account exists error
		await page.waitForSelector('ion-alert', { timeout: 10000 });
		const alertText = await page.locator('ion-alert').textContent();
		expect(alertText?.toLowerCase()).toContain('account');
	});

	test('should validate required form fields', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('create-account-enabled');
		await page.goto('/sign-up');

		// Try to submit without filling anything - button should be disabled
		const submitButton = page.locator('#submitButton');
		await expect(submitButton).toBeDisabled();

		// Fill only email, should still be disabled
		await page.fill('#emailAddress input', 'test@test.com');
		await expect(submitButton).toBeDisabled();

		// Fill all required fields except legal checkbox
		await page.fill('#firstName input', 'Test');
		await page.fill('#lastName input', 'User');
		await page.fill('#zipCode input', '80208');
		await page.fill('#password input', 'TestPassword123!');
		await page.fill('#password2 input', 'TestPassword123!');

		// Should still be disabled without legal checkbox
		await expect(submitButton).toBeDisabled();

		// Check legal checkbox
		await page.click('#legalCheckbox');

		// Now button should be enabled
		await expect(submitButton).toBeEnabled();
	});

	test('should not show Create Account button when disabled', async ({
		page,
		seedScenario,
	}) => {
		// Setup with create account disabled
		await seedScenario('create-account-disabled');
		await page.goto('/sign-in');

		// Create Account button should not be visible
		const createAccountButton = page.locator('#createAccountButton');
		await expect(createAccountButton).toBeHidden();

		// Try navigating directly to sign-up page
		await page.goto('/sign-up');

		// Should show disabled message or not show the form
		await expect(
			page.locator('text=CREATE_ACCOUNT_DISABLED'),
		).toBeVisible();
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
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});

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
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});

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
