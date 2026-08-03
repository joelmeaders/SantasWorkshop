import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	randomAccount,
} from '../../fixtures/account-helpers';
import {
	addChildViaUi,
	defaultTestChild,
	selectAppointmentViaUi,
	submitRegistrationViaUi,
} from '../../fixtures/registration-helpers';

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

	test('PUB-009 completes a registration path in Spanish', async ({
		page,
		seedScenario,
		seedDateTimeSlots,
	}) => {
		await seedScenario('create-account-enabled');
		await seedDateTimeSlots([
			{
				id: 'spanish-registration-slot',
				programYear: 2026,
				dateTime: '2026-12-12T16:00:00.000Z',
				lastUpdated: '2026-01-01T00:00:00.000Z',
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		await page.goto('/');
		await page.locator('#languageToggle').click();
		await expect(
			page.getByText('Crear una cuenta', { exact: true }),
		).toBeVisible();

		await createAccountViaUi(page, randomAccount());
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'spanish-registration-slot');
		await submitRegistrationViaUi(page);
		await expect(
			page.getByText('Esta es tu entrada al evento', { exact: true }),
		).toBeVisible();
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

	test('PUB-008 displays a global-alert update without reloading the session', async ({
		page,
		seedScenario,
		seedPublicParams,
	}) => {
		await seedScenario('create-account-enabled');
		await page.goto('/');
		await expect(page.locator('ion-alert')).toHaveCount(0);

		await seedPublicParams({
			globalAlert: {
				displayAlert: true,
				titleEn: 'Live operational notice',
				titleEs: 'Aviso operativo en vivo',
				messageEn: 'This update arrived after the application opened.',
				messageEs:
					'Esta actualización llegó después de abrir la aplicación.',
			},
		});

		const alert = page.locator('ion-alert');
		await expect(alert).toContainText('Live operational notice', {
			timeout: 15000,
		});
		await expect(alert).toContainText(
			'This update arrived after the application opened.',
		);
	});
});
