import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	fillCreateAccountForm,
	randomAccount,
	selectReferralViaUi,
	signInViaUi,
	signOutViaUi,
} from '../../fixtures/account-helpers';

test.describe('customer account and session access', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('AUTH-001 creates an account and enters authenticated registration', async ({
		page,
	}) => {
		const account = randomAccount();
		await createAccountViaUi(page, account);

		await expect(page).toHaveURL(/\/pre-registration\/overview$/);
		await expect(page.locator('#menuButton')).toBeVisible();
		await expect(page.locator('#children-heading')).toBeVisible();
	});

	test('AUTH-002 requires valid fields and policy acceptance', async ({
		page,
	}) => {
		const account = randomAccount();
		await page.goto('/sign-up');
		const submitButton = page.locator('#submitButton');
		await expect(submitButton).toHaveClass(/button-disabled/);

		await page.fill('#firstName input', account.firstName);
		await page.fill('#lastName input', account.lastName);
		await page.fill('#zipCode input', account.zipCode);
		await page.fill('#emailAddress input', account.emailAddress);
		await page.fill('#password input', account.password);
		await page.fill('#password2 input', account.password);
		await expect(submitButton).toHaveClass(/button-disabled/);

		await page.click('#legalCheckbox');
		await expect(submitButton).toHaveClass(/button-disabled/);

		await selectReferralViaUi(page);
		await expect(submitButton).not.toHaveClass(/button-disabled/, {
			timeout: 15000,
		});
	});

	test('AUTH-003 shows a recovery message for a duplicate account', async ({
		page,
	}) => {
		const existingAccount = randomAccount();
		await createAccountViaUi(page, existingAccount);
		await signOutViaUi(page);

		await page.goto('/sign-up');
		await fillCreateAccountForm(page, {
			...randomAccount(),
			emailAddress: existingAccount.emailAddress,
		});
		await page.click('#legalCheckbox');
		await selectReferralViaUi(page);
		await expect(page.locator('#submitButton')).not.toHaveClass(
			/button-disabled/,
			{ timeout: 15000 },
		);
		await page.click('#submitButton');
		await page.click('ion-alert button.alert-button-role-confirm');

		const alert = page.locator('ion-alert');
		await expect(alert).toContainText(/account/i, { timeout: 10000 });
		await expect(alert).toContainText(existingAccount.emailAddress);
	});

	test('AUTH-004 and AUTH-005 preserve return access and protect private routes', async ({
		page,
	}) => {
		const account = randomAccount();
		await createAccountViaUi(page, account);
		await signOutViaUi(page);

		await page.goto('/pre-registration/overview');
		await expect(page).toHaveURL(/\/\?mode=sign-in/);
		await signInViaUi(page, account);
		await expect(page.locator('#children-heading')).toBeVisible({
			timeout: 15000,
		});
	});

	test('AUTH-006 redirects an authenticated user away from redundant entry routes', async ({
		page,
	}) => {
		const account = randomAccount();
		await createAccountViaUi(page, account);

		await page.goto('/sign-in');
		await expect(page).toHaveURL(/\/pre-registration\/overview$/);
		await page.goto('/sign-up');
		await expect(page).toHaveURL(/\/pre-registration\/overview$/);
	});

	test('AUTH-007 accepts a password recovery request through the Auth emulator', async ({
		page,
	}) => {
		const account = randomAccount();
		await createAccountViaUi(page, account);
		await signOutViaUi(page);

		await page.goto('/?mode=reset');
		await page.fill('#resetPasswordEmail input', account.emailAddress);
		const resetButton = page.locator('#resetPasswordButton');
		await expect(resetButton).not.toHaveClass(/button-disabled/, {
			timeout: 15000,
		});
		await resetButton.click();
		await expect(
			page.getByText('Email has been sent!', { exact: true }),
		).toBeVisible({
			timeout: 15000,
		});
	});

	test('AUTH-008 shows a recovery message for invalid credentials', async ({
		page,
	}) => {
		await page.goto('/?mode=sign-in');
		await page.fill('#signInEmail input', 'missing@example.com');
		await page.fill('#signInPassword input', 'WrongPassword123!');
		await page.click('#signInButton');

		const alert = page.locator('ion-alert');
		await expect(alert).toBeVisible({ timeout: 10000 });
		await expect(alert).toContainText(
			/credential|password|account|user-not-found/i,
		);
	});
});
