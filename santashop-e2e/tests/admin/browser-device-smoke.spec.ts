import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('staff browser and device compatibility', () => {
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});

	test('BROWSER-ADMIN-001 keeps sign-in, navigation, and manual scan entry usable', async ({
		page,
		seedAdminUser,
		seedPublicParams,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);

		const checkInNav = page.locator('#checkInNav');
		await expect(checkInNav).toBeEnabled({ timeout: 15000 });
		await checkInNav.click();
		await expect(page).toHaveURL(/\/admin\/checkin(?:\/scan)?$/);
		await page.locator('#manualCheckInCodeButton').click();
		const alert = page.locator('ion-alert').last();
		await expect(alert).toBeVisible();
		await expect(alert.locator('input')).toBeEditable();
		await alert.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(alert).toHaveCount(0);
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			)
			.toBe(true);
	});
});
