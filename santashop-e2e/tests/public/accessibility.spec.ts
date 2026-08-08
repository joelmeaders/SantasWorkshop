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
});
