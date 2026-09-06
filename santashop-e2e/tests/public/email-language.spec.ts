import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	randomAccount,
	signInViaUi,
	signOutViaUi,
} from '../../fixtures/account-helpers';

test('LANG-001 saves signup language and restores later changes in a fresh browser context', async ({
	page,
	browser,
	clearData,
	seedScenario,
}) => {
	await clearData();
	await seedScenario('create-account-enabled');
	const account = randomAccount();
	await page.goto('/sign-up');
	await page.locator('#languageToggle').click();
	await expect(page.locator('#languageToggle')).toHaveJSProperty(
		'checked',
		false,
	);
	await createAccountViaUi(page, account);
	await signOutViaUi(page);

	const fresh = await browser.newContext({
		baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4100',
		locale: 'en-US',
	});
	try {
		const otherPage = await fresh.newPage();
		await signInViaUi(otherPage, account);
		await otherPage.locator('#menuButton').click();
		const toggle = otherPage.locator('ion-popover #languageToggle');
		await expect(toggle).toHaveJSProperty('checked', false);
		const saved = otherPage.waitForResponse(
			(response) =>
				response.url().includes('updatePreferredLanguage') &&
				response.request().method() === 'POST',
		);
		await toggle.click();
		expect((await saved).ok()).toBeTruthy();
		await otherPage.locator('#signOutButton').click();
		await expect(otherPage.locator('#signInButton')).toBeVisible();
	} finally {
		await fresh.close();
	}
	// The first browser still has Spanish locally. The server preference must win.
	await signInViaUi(page, account);
	await page.locator('#menuButton').click();
	await expect(page.locator('ion-popover #languageToggle')).toHaveJSProperty(
		'checked',
		true,
	);
});
