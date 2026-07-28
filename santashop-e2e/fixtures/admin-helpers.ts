import { expect, type Page } from '@playwright/test';

import type {
	E2eAdminSeedUser,
	E2eSeedDateTimeSlot,
} from './test-fixtures';

export const defaultAdminAccount = (
	overrides: Partial<E2eAdminSeedUser> = {},
): E2eAdminSeedUser => ({
	uid: 'admin-e2e-user',
	emailAddress: 'admin-e2e@test.com',
	password: 'Test1234!',
	admin: true,
	...overrides,
});

export const fillAdminSignInForm = async (
	page: Page,
	account: Pick<E2eAdminSeedUser, 'emailAddress' | 'password'>,
): Promise<void> => {
	await expect(page.locator('#adminSignInEmail input')).toBeVisible({
		timeout: 15000,
	});
	await fillField(page, '#adminSignInEmail input', account.emailAddress);
	await fillField(page, '#adminSignInPassword input', account.password);
};

export const signInAdminViaUi = async (
	page: Page,
	account: Pick<E2eAdminSeedUser, 'emailAddress' | 'password'>,
): Promise<void> => {
	await page.goto('/');
	await fillAdminSignInForm(page, account);
	await expect(page.locator('#adminSignInButton')).not.toHaveClass(
		/button-disabled/,
		{ timeout: 15000 },
	);
	await page.click('#adminSignInButton');
	await page.waitForURL('**/admin/landing', { timeout: 30000 });
	await expect(page.locator('#scheduleEditorNav')).toBeVisible({
		timeout: 15000,
	});
};

export const navigateToScheduleEditorViaLanding = async (
	page: Page,
): Promise<void> => {
	await expect(page.locator('#scheduleEditorNav')).toBeVisible({
		timeout: 15000,
	});
	await Promise.all([
		page.waitForURL('**/admin/schedule-editor', { timeout: 30000 }),
		page.click('#scheduleEditorNav'),
	]);
	await expect(page.locator('#generateSchedulesButton')).toBeVisible({
		timeout: 15000,
	});
};

export const fillIonicInput = async (
	page: Page,
	selector: string,
	value: string,
): Promise<void> => {
	const input = page.locator(`${selector} input`);
	await expect(input).toBeVisible({ timeout: 15000 });
	await input.fill(value);
	await expect(input).toHaveValue(value, { timeout: 10000 });
	await input.evaluate((element) => {
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
	});
	await input.blur();
};

export const clickIonCheckbox = async (
	page: Page,
	selector: string,
): Promise<void> => {
	const checkbox = page.locator(selector);
	await expect(checkbox).toBeVisible({ timeout: 10000 });
	await checkbox.click();
};

export const clickIonToggle = async (
	page: Page,
	selector: string,
): Promise<void> => {
	const toggle = page.locator(selector);
	await expect(toggle).toBeVisible({ timeout: 10000 });
	await toggle.click();
};

export const confirmAlertButton = async (
	page: Page,
	buttonText: string,
): Promise<void> => {
	const alert = page.locator('ion-alert');
	await expect(alert).toBeVisible({ timeout: 10000 });
	const button = alert.getByRole('button', { name: buttonText });
	await expect(button).toBeVisible({ timeout: 10000 });
	await button.click();
};

export const scheduleSlot = (
	overrides: Partial<E2eSeedDateTimeSlot> & {
		id: string;
		dateTime: string;
	},
): E2eSeedDateTimeSlot => ({
	id: overrides.id,
	programYear: 2025,
	dateTime: overrides.dateTime,
	maxSlots: 10,
	slotsReserved: 0,
	enabled: true,
	...overrides,
});

const fillField = async (
	page: Page,
	selector: string,
	value: string,
): Promise<void> => {
	const input = page.locator(selector);
	await input.fill(value);
	await expect(input).toHaveValue(value, { timeout: 10000 });
};
