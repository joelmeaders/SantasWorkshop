import { test, expect } from '../fixtures/test-fixtures';
import {
	completeReferralViaUi,
	createAccountViaUi,
	randomAccount,
	signOutViaUi,
} from '../fixtures/account-helpers';

test.describe('Sign Out Flow', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('should sign the user out and block protected routes', async ({
		page,
	}) => {
		const account = randomAccount();

		await createAccountViaUi(page, account);
		await completeReferralViaUi(page);
		await signOutViaUi(page);

		expect(page.url()).toContain('/sign-in');
		await page.goto('/pre-registration/overview');
		await page.waitForURL('**/sign-in', { timeout: 30000 });
		await expect(page.locator('#signInButton')).toBeVisible({
			timeout: 10000,
		});
	});
});
