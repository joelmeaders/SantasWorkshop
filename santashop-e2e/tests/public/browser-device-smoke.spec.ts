import { test, expect } from '../../fixtures/test-fixtures';
import { fillIonicInput } from '../../fixtures/account-helpers';

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

		const firstNameSelector = '#firstName input:not(.cloned-input)';
		const lastNameSelector = '#lastName input:not(.cloned-input)';
		const firstName = page.locator(firstNameSelector);
		const lastName = page.locator(lastNameSelector);
		await fillIonicInput(page, firstNameSelector, 'Browser');
		await fillIonicInput(page, lastNameSelector, 'Matrix');
		await expect(firstName).toHaveValue('Browser');
		await expect(lastName).toHaveValue('Matrix');
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						document.documentElement.scrollWidth <=
						window.innerWidth,
				),
			)
			.toBe(true);
	});
});
