import { test, expect } from '../fixtures/test-fixtures';

test.describe('Global Alert Flow', () => {
	test.beforeEach(async ({ clearData, seedPublicParams }) => {
		await clearData();
		await seedPublicParams({
			registrationEnabled: true,
			maintenanceModeEnabled: false,
			weatherModeEnabled: false,
			createAccountEnabled: true,
			globalAlert: {
				displayAlert: true,
				titleEn: 'Important notice',
				titleEs: 'Aviso importante',
				messageEn: 'This is a global alert test message.',
				messageEs: 'Este es un mensaje de prueba de alerta global.',
			},
		});
	});

	test('should display the seeded global alert message', async ({ page }) => {
		await page.goto('/');

		const globalAlert = page.locator('ion-alert');
		await expect(globalAlert).toBeVisible({ timeout: 10000 });
		await expect(globalAlert).toContainText('Important notice');
		await expect(globalAlert).toContainText(
			'This is a global alert test message.',
		);
		await page.locator('ion-alert button.alert-button').click();
		await expect(globalAlert).toBeHidden({ timeout: 10000 });
	});
});
