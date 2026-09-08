import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	fillCreateAccountForm,
	randomAccount,
	selectReferralViaUi,
	signInViaUi,
	signOutViaUi,
} from '../../fixtures/account-helpers';
import {
	E2E_AUTH_EMULATOR_URL,
	E2E_PROJECT_ID,
} from '../../fixtures/season';

const readPasswordResetLink = async (
	request: import('@playwright/test').APIRequestContext,
	emailAddress: string,
): Promise<string> => {
	const response = await request.get(
		`${E2E_AUTH_EMULATOR_URL}/emulator/v1/projects/${encodeURIComponent(E2E_PROJECT_ID)}/oobCodes`,
	);
	if (!response.ok()) return '';

	const payload = (await response.json()) as {
		oobCodes?: {
			email?: string;
			requestType?: string;
			oobLink?: string;
		}[];
	};
	const matchingCodes = payload.oobCodes ?? [];
	for (let index = matchingCodes.length - 1; index >= 0; index -= 1) {
		const code = matchingCodes[index];
		if (
			code?.email === emailAddress &&
			code.requestType === 'PASSWORD_RESET' &&
			code.oobLink
		) {
			return code.oobLink;
		}
	}

	return '';
};

test.describe('customer account and session access', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('AUTH-001 creates an account and enters authenticated registration', async ({
		page,
	}) => {
		const account = randomAccount();
		account.zipCode = '01234';
		await createAccountViaUi(page, account);

		await expect(page).toHaveURL(/\/pre-registration\/overview$/);
		await expect(page.locator('#menuButton')).toBeVisible();
		await expect(page.locator('#children-heading')).toBeVisible();
		await page.goto('/pre-registration/profile');
		await expect(
			page.locator('ion-input[formControlName="zipCode"] input'),
		).toHaveValue('01234');
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

	test('AUTH-010 accepts a long email through signup and later sign-in', async ({
		page,
	}) => {
		const account = randomAccount();
		account.emailAddress = account.emailAddress.replace(
			'@',
			'+long-email-validation-journey@',
		);
		expect(account.emailAddress.length).toBeGreaterThan(40);
		await createAccountViaUi(page, account);
		await signOutViaUi(page);
		await signInViaUi(page, account);
		await expect(page.locator('#children-heading')).toBeVisible();
	});

	test('AUTH-011 updates visible email errors as the value changes', async ({
		page,
	}) => {
		await page.goto('/sign-up');
		const emailField = page.locator('#emailAddress');
		const input = emailField.locator('input:not([disabled])');
		await input.focus();
		await input.blur();
		await expect(
			emailField.getByText('This field is required'),
		).toBeVisible();

		await input.fill(`${'a'.repeat(242)}@example.test`);
		await input.blur();
		await expect(emailField.getByText(/Maximum length is/)).toBeVisible();

		await input.fill('not-an-email');
		await input.blur();
		await expect(
			emailField.getByText('Must be a valid email address'),
		).toBeVisible();
		await expect(
			emailField.getByText('This field is required'),
		).toBeHidden();

		await input.fill('valid-email@example.test');
		await input.blur();
		await expect(emailField).toHaveJSProperty('errorText', '');
		await expect(
			emailField.getByText('Must be a valid email address'),
		).toBeHidden();
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

	test('AUTH-012 completes password recovery with the Auth emulator OOB link', async ({
		page,
		request,
	}) => {
		const account = randomAccount();
		const replacementPassword = `${account.password}Reset`;
		await createAccountViaUi(page, account);
		await signOutViaUi(page);

		await page.goto('/?mode=reset');
		await page.fill('#resetPasswordEmail input', account.emailAddress);
		await page.locator('#resetPasswordButton').click();
		await expect(
			page.getByText('Email has been sent!', { exact: true }),
		).toBeVisible({ timeout: 15000 });

		let resetLink = '';
		await expect
			.poll(
				async () => {
					resetLink = await readPasswordResetLink(
						request,
						account.emailAddress,
					);
					return resetLink;
				},
				{ timeout: 15000 },
			)
			.toBeTruthy();
		if (!resetLink) throw new Error('Auth emulator reset link was not created.');

		const resetResponse = await request.get(
			`${resetLink}&newPassword=${encodeURIComponent(replacementPassword)}`,
		);
		if (!resetResponse.ok()) {
			throw new Error(
				`Auth emulator password reset failed (${resetResponse.status()}): ${await resetResponse.text()}`,
			);
		}

		await page.goto('/?mode=sign-in');
		await page.fill('#signInEmail input', account.emailAddress);
		await page.fill('#signInPassword input', account.password);
		await page.locator('#signInButton').click();
		const rejectedAlert = page.locator('ion-alert');
		await expect(rejectedAlert).toBeVisible({ timeout: 10000 });
		await expect(rejectedAlert).toContainText(
			/credential|password|account|authentication/i,
		);
		await rejectedAlert.getByRole('button').first().click();

		await signInViaUi(page, {
			emailAddress: account.emailAddress,
			password: replacementPassword,
		});
		await expect(page).toHaveURL(/\/pre-registration\/overview$/);
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

	test('AUTH-009 opens and dismisses both required legal documents', async ({
		page,
	}) => {
		await page.goto('/sign-up');

		await page
			.getByText('Terms and Conditions', { exact: true })
			.first()
			.click();
		const termsModal = page.locator('ion-modal').filter({
			has: page.locator('app-terms-of-service-modal'),
		});
		await expect(termsModal).toBeVisible();
		await termsModal
			.getByRole('button', { name: 'Close', exact: true })
			.click();
		await expect(termsModal).toBeHidden();

		await page.getByText('Privacy Policy', { exact: true }).first().click();
		const privacyModal = page.locator('ion-modal').filter({
			has: page.locator('app-privacy-policy-modal'),
		});
		await expect(privacyModal).toBeVisible();
		await privacyModal
			.getByRole('button', { name: 'Close', exact: true })
			.click();
		await expect(privacyModal).toBeHidden();
	});
});
