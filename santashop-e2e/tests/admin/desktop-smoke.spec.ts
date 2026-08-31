import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('desktop staff workspace', () => {
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});

	test('VIEWPORT-ADMIN-001 keeps core staff navigation usable on desktop', async ({
		page,
		seedAdminUser,
		seedPublicParams,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);

		await expect(
			page.getByText('DSCS Event Administration', { exact: true }),
		).toBeVisible();
		await expect(page.locator('#checkInNav')).toBeVisible();
		await expect(page.locator('#searchNav')).toBeVisible();
		await expect(page.locator('#scanRiskReviewNav')).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			)
			.toBe(true);
	});
});
