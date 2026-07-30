import { test, expect } from '../../fixtures/test-fixtures';
import type { Locator } from '@playwright/test';
import {
	defaultAdminAccount,
	fillAdminSignInForm,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('staff identity, authorization, and runtime controls', () => {
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});

	test('STAFF-001 redirects unauthenticated operational access to sign-in', async ({
		page,
		seedPublicParams,
	}) => {
		await seedPublicParams({});
		await page.goto('/admin/landing');
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('#adminSignInButton')).toBeVisible({
			timeout: 15000,
		});
	});

	test('STAFF-002 allows an authorized admin into the operational workspace', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);

		await expect(page.locator('#searchNav')).toBeVisible();
		await expect(page.locator('#scheduleEditorNav')).toBeVisible();
	});

	test('STAFF-003 denies the operational workspace to a non-privileged account', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount({
			uid: 'non-admin-e2e-user',
			emailAddress: 'non-admin-e2e@test.com',
			admin: false,
		});
		await seedPublicParams({});
		await seedAdminUser(account);
		await page.goto('/');
		await fillAdminSignInForm(page, account);
		await page.click('#adminSignInButton');

		await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
		await expect(page.locator('#adminSignInButton')).toBeVisible({
			timeout: 15000,
		});
		await expect(page.locator('#scheduleEditorNav')).toHaveCount(0);
	});

	test('STAFF-004 signs out and blocks protected operational routes', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);
		await page.click('#adminSignOutButton');
		await expect(page).toHaveURL(/\/$/, { timeout: 30000 });

		await page.goto('/admin/landing');
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('#adminSignInButton')).toBeVisible();
	});

	test('STAFF-005 applies runtime feature controls to staff navigation', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({
			admin: {
				checkinEnabled: false,
				onsiteRegistrationEnabled: false,
				preRegistrationEnabled: false,
				allowCancelRegistration: false,
				allowChangeRegistration: false,
			},
		});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);

		await expectIonicDisabled(page.locator('#checkInNav'));
		await expectIonicDisabled(page.locator('#onSiteRegistrationNav'));
		await expectIonicDisabled(page.locator('#preRegistrationNav'));
		await expectIonicDisabled(page.locator('#checkInTab'));
		await expectIonicDisabled(page.locator('#onSiteRegistrationTab'));
		await expect(page.locator('#searchNav')).toBeVisible();
	});
});

const expectIonicDisabled = async (locator: Locator): Promise<void> => {
	await expect(locator).toBeVisible({ timeout: 10000 });
	await expect
		.poll(() =>
			locator.evaluate((element) => Reflect.get(element, 'disabled')),
		)
		.toBe(true);
};
