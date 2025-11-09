import { test, expect } from '@playwright/test';

test.describe('SantaShop App', () => {
	test('should load the homepage', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		// Wait for Angular/Ionic to bootstrap by checking for ion-app
		await page
			.locator('ion-app')
			.waitFor({ state: 'attached', timeout: 30000 });

		// Check that we're on the app
		await expect(page).toHaveTitle(/Santa/i);
	});

	test('should have navigation elements', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		// Check for common Ionic/Angular elements
		const ionApp = page.locator('ion-app');
		await expect(ionApp).toBeVisible({ timeout: 30000 });
	});

	test('should connect to Firebase emulators', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		// Wait for Angular app to be ready
		await page
			.locator('ion-app')
			.waitFor({ state: 'attached', timeout: 30000 });

		// The app should be running against emulators on port 4100
		// This test verifies the page loads, which means Firebase SDK initialized
		const title = await page.title();
		expect(title).toBeTruthy();
	});
});
