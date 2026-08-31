import { randomInt, randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export interface TestAccount {
	firstName: string;
	lastName: string;
	zipCode: string;
	emailAddress: string;
	password: string;
}

// The sign-up form enforces emailAddress maxLength(40) and lastName
// maxLength(25), so generated values must stay short while remaining unique.
const buildUniqueToken = (): string => {
	const timeToken = Date.now().toString(36);
	const randomToken = randomUUID().replaceAll('-', '').slice(0, 6);

	return `${timeToken}${randomToken}`;
};

const buildPassword = (): string =>
	`Test1!${randomUUID().replaceAll('-', '').slice(0, 10)}`;

export const randomAccount = (): TestAccount => {
	const token = buildUniqueToken();
	const zipSuffix = randomInt(0, 10);

	return {
		firstName: 'Test',
		lastName: 'User',
		zipCode: `8020${zipSuffix}`,
		// e.g. "e2e-lz4k9x1a2b3c@test.com" — comfortably under 40 characters.
		emailAddress: `e2e-${token}@test.com`,
		password: buildPassword(),
	};
};

export const fillCreateAccountForm = async (
	page: Page,
	account: TestAccount,
): Promise<void> => {
	await expect(page.locator('#firstName input')).toBeVisible({
		timeout: 15000,
	});
	await fillField(page, '#firstName input', account.firstName);
	await fillField(page, '#lastName input', account.lastName);
	await fillField(page, '#zipCode input', account.zipCode);
	await fillField(page, '#emailAddress input', account.emailAddress);
	await fillField(page, '#password input', account.password);
	await fillField(page, '#password2 input', account.password);
};

/**
 * Fills an Ionic input and verifies the value registered. Ionic's `ion-input`
 * proxies to an inner native input, and Angular's form binding can lag behind a
 * plain `fill`, so asserting the value forces the control to settle before the
 * next interaction.
 */
const fillField = async (
	page: Page,
	selector: string,
	value: string,
): Promise<void> => {
	const input = page.locator(selector).first();
	await input.fill(value);
	await expect(input).toHaveValue(value, { timeout: 10000 });
};

const confirmCreateAccountEmail = async (page: Page): Promise<void> => {
	// Ionic encodes the button role in a CSS class (not a role attribute), so
	// the confirm action is targeted via `alert-button-role-confirm`.
	const confirmButton = page.locator(
		'ion-alert button.alert-button-role-confirm',
	);

	await expect(confirmButton).toBeVisible({ timeout: 10000 });
	await confirmButton.click();
};

export const createAccountViaUi = async (
	page: Page,
	account: TestAccount,
	referralChoice = 'Denver Human Services DHS',
	otherAnswer = 'Neighborhood friend',
): Promise<void> => {
	await page.goto('/sign-up');
	await fillCreateAccountForm(page, account);
	await selectReferralViaUi(page, referralChoice, otherAnswer);
	await page.click('#legalCheckbox');
	// ion-button reflects its disabled state via the `button-disabled` class;
	// waiting for it to clear also allows the input debounce to flush.
	await expect(page.locator('#submitButton')).not.toHaveClass(
		/button-disabled/,
		{ timeout: 15000 },
	);
	await page.click('#submitButton');
	await confirmCreateAccountEmail(page);
	// Firebase realtime listeners keep the network busy, so `networkidle` never
	// settles. Wait for the URL change and a page element instead.
	await page.waitForURL('**/pre-registration/overview', { timeout: 30000 });
	await expect(page.locator('#children-heading')).toBeVisible({
		timeout: 15000,
	});
};
export const selectReferralViaUi = async (
	page: Page,
	choice = 'Denver Human Services DHS',
	otherAnswer = 'Neighborhood friend',
): Promise<void> => {
	await page.click('#referralSelector');
	const modal = page.locator('ion-modal');
	await expect(modal).toBeVisible({ timeout: 10000 });

	if (choice === 'Other') {
		const searchInput = modal.locator('#referralSearchbar input');
		await searchInput.fill(choice);
		await searchInput.press('Tab');
	}

	const referralOption = modal.getByRole('button', {
		name: choice,
		exact: true,
	});
	await expect(referralOption).toBeVisible({ timeout: 10000 });
	await referralOption.click();

	if (choice === 'Other') {
		await modal.locator('#referralOther input').fill(otherAnswer);
	}

	const saveButton = modal.locator('#saveReferralButton');
	await expect(saveButton).toBeVisible({ timeout: 10000 });
	await expect(saveButton).not.toHaveClass(/button-disabled/, {
		timeout: 10000,
	});
	await saveButton.click();
	await expect(modal).toHaveCount(0, { timeout: 10000 });
};

export const signInViaUi = async (
	page: Page,
	account: Pick<TestAccount, 'emailAddress' | 'password'>,
): Promise<void> => {
	await page.goto('/?mode=sign-in');
	await expect(page.locator('#signInEmail input')).toBeVisible({
		timeout: 15000,
	});
	await page.fill('#signInEmail input', account.emailAddress);
	await page.fill('#signInPassword input', account.password);
	await expect(page.locator('#signInButton')).not.toHaveClass(
		/button-disabled/,
		{ timeout: 15000 },
	);
	await page.click('#signInButton');
	await page.waitForURL('**/pre-registration/overview', { timeout: 30000 });
	// The account has already chosen a referral, so the full overview (with the
	// app header/menu) renders rather than the referral takeover.
	await expect(page.locator('#menuButton')).toBeVisible({ timeout: 15000 });
};

export const signOutViaUi = async (page: Page): Promise<void> => {
	await page.click('#menuButton');
	const signOutButton = page.locator('#signOutButton');
	await expect(signOutButton).toBeVisible({ timeout: 10000 });
	await Promise.all([
		page.waitForURL((url) => url.pathname === '/' && url.searchParams.get('mode') === 'sign-in', { timeout: 30000 }),
		signOutButton.click(),
	]);
	await expect(page.locator('#signInButton')).toBeVisible({ timeout: 10000 });
};
