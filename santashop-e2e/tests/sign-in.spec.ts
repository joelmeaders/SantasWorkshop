import { test, expect } from '../fixtures/test-fixtures';
import {
	completeReferralViaUi,
	createAccountViaUi,
	randomAccount,
	signInViaUi,
	signOutViaUi,
} from '../fixtures/account-helpers';

test.describe('Sign In Flow', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('should allow an existing user to sign in after signing out', async ({
		page,
	}) => {
		const account = randomAccount();

		await createAccountViaUi(page, account);
		await completeReferralViaUi(page);
		await signOutViaUi(page);
		await signInViaUi(page, account);

		expect(page.url()).toContain('/pre-registration/overview');
		await expect(page.locator('#menuButton')).toBeVisible({
			timeout: 10000,
		});
	});
});
