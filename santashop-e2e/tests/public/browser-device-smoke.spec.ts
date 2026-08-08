import { test, expect } from '../../fixtures/test-fixtures';

test.describe('public browser and device compatibility', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('BROWSER-PUB-001 keeps account entry usable without horizontal overflow', async ({
		page,
	}) => {
		await page.goto('/');
		await page.locator('#createAccountButton').click();
		await expect(page).toHaveURL(/\/sign-up$/);

		const firstName = page.locator('#firstName input:not(.cloned-input)');
		const lastName = page.locator('#lastName input:not(.cloned-input)');
		await firstName.fill('Browser');
		await lastName.fill('Matrix');
		await expect(firstName).toHaveValue('Browser');
		await expect(lastName).toHaveValue('Matrix');
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			)
			.toBe(true);
	});
});
