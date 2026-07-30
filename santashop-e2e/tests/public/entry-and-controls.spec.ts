import { test, expect } from '../../fixtures/test-fixtures';

test.describe('public entry and runtime operating controls', () => {
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});

	test('PUB-001 exposes the public account entry routes', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('create-account-enabled');
		await page.goto('/');

		await expect(
			page.getByText('Create An Account', { exact: true }),
		).toBeVisible();
		await expect(page.getByText('Sign In', { exact: true })).toBeVisible();
	});

	test('PUB-002 switches the public experience to Spanish', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('create-account-enabled');
		await page.goto('/');
		await expect(
			page.getByText('Create An Account', { exact: true }),
		).toBeVisible();

		await page.locator('#languageToggle').click();

		await expect(
			page.getByText('Crear una cuenta', { exact: true }),
		).toBeVisible({ timeout: 10000 });
	});

	test('PUB-003 blocks account creation when the runtime control is disabled', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('create-account-disabled');
		await page.goto('/sign-in');
		await expect(page.locator('#createAccountButton')).toBeHidden();

		await page.goto('/sign-up');
		await expect(page.locator('.alert p')).toBeVisible();
		await expect(page.locator('#submitButton')).toHaveCount(0);
	});

	test('PUB-004 shows the registration-closed state', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('registration-closed');
		await page.goto('/');
		await expect(page.locator('app-registration-closed')).toBeVisible({
			timeout: 10000,
		});
	});

	test('PUB-005 shows the maintenance state', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('maintenance-mode');
		await page.goto('/');
		await expect(page.locator('app-maintenance')).toBeVisible({
			timeout: 10000,
		});
	});

	test('PUB-006 shows the weather-closure state', async ({
		page,
		seedScenario,
	}) => {
		await seedScenario('weather-mode');
		await page.goto('/');
		await expect(page.locator('app-bad-weather')).toBeVisible({
			timeout: 10000,
		});
	});

	test('PUB-007 displays and dismisses a seeded global alert', async ({
		page,
		seedPublicParams,
	}) => {
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
		await page.goto('/');

		const globalAlert = page.locator('ion-alert');
		await expect(globalAlert).toBeVisible({ timeout: 10000 });
		await expect(globalAlert).toContainText('Important notice');
		await expect(globalAlert).toContainText(
			'This is a global alert test message.',
		);
		await globalAlert.locator('button.alert-button').click();
		await expect(globalAlert).toBeHidden({ timeout: 10000 });
	});
});
