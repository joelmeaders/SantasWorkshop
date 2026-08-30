import { expectNoBlockingAccessibilityViolations } from '../../fixtures/accessibility-helpers';
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('public critical-path accessibility', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('A11Y-PUB-001 has no blocking violations on account entry', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.locator('#createAccountButton')).toBeVisible({
			timeout: 15000,
		});

		await expectNoBlockingAccessibilityViolations(page);
	});

	test('A11Y-PUB-002 has no blocking violations on account creation', async ({
		page,
	}) => {
		await page.goto('/sign-up');
		await expect(page.locator('#firstName input')).toBeVisible({
			timeout: 15000,
		});

		await expectNoBlockingAccessibilityViolations(page);
	});

	test('A11Y-PUB-003 has no violations in the Spanish entry state', async ({
		page,
	}) => {
		await page.goto('/');
		await page.locator('#languageToggle').click();
		await expect(
			page.getByText('Crear una cuenta', { exact: true }),
		).toBeVisible();

		await expectNoBlockingAccessibilityViolations(page);
	});

	for (const scenario of [
		'registration-closed',
		'maintenance-mode',
		'weather-mode',
	]) {
		test(`A11Y-PUB-004 has no violations in ${scenario}`, async ({
			page,
			seedScenario,
		}) => {
			await seedScenario(scenario);
			await page.goto('/');
			await expect(
				page.locator('ion-modal app-operational-notice'),
			).toBeVisible({ timeout: 10000 });

			await expectNoBlockingAccessibilityViolations(page);
		});
	}
});
