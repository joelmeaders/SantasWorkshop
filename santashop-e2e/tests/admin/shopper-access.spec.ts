import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	defaultOwnerAccount,
	fillAdminSignInForm,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { e2eDateTime } from '../../fixtures/season';

const shopper = {
	uid: 'shopper-access-review-e2e',
	firstName: 'Casey',
	lastName: 'Shopper',
	emailAddress: 'shopper-access-e2e@example.test',
	zipCode: '80202',
	code: 'E2EACC01',
	dateTime: e2eDateTime(12, 15, 16),
};

async function openReview(page: Page): Promise<void> {
	await page.goto('/admin/checkin/scan');
	await page.locator('#manualCheckInCodeButton').click();
	const alert = page.locator('ion-alert').last();
	await expect(alert).toBeVisible();
	await alert.locator('input').fill(shopper.code);
	await alert.getByRole('button', { name: 'OK', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/checkin\/review$/);
}

test.describe('shopper access on registration review', () => {
	test.beforeEach(
		async ({
			clearData,
			seedPublicParams,
			seedAdminUser,
			seedRegistration,
		}) => {
			await clearData();
			await seedPublicParams({});
			await seedAdminUser({
				uid: shopper.uid,
				emailAddress: shopper.emailAddress,
				password: 'SyntheticPassword123!',
				roles: [],
			});
			await seedRegistration(shopper);
		},
	);

	test('shows shopper access to an admin without allowing changes', async ({
		page,
		seedAdminUser,
	}) => {
		const admin = defaultAdminAccount({ roles: ['admin'] });
		await seedAdminUser(admin);
		await signInAdminViaUi(page, admin);
		await openReview(page);
		const panel = page.getByTestId('shopper-access-panel');
		await expect(panel).toContainText('Access is enabled');

		await expect(panel.getByTestId('change-shopper-access')).toHaveCount(0);
	});

	test('shows read-only shopper access to an owner but leaves email search unchanged', async ({
		page,
		seedAdminUser,
	}) => {
		const owner = defaultOwnerAccount();
		await seedAdminUser(owner);
		await signInAdminViaUi(page, owner);
		await page.goto('/admin/search/by-email');
		await expect(
			page.locator('ion-input[formcontrolname=emailAddress]'),
		).toBeVisible();
		await expect(page.getByTestId('find-shopper-account')).toHaveCount(0);
		await expect(page.getByTestId('shopper-access-panel')).toHaveCount(0);
		await openReview(page);
		await expect(page.getByTestId('shopper-access-panel')).toContainText(
			'Access is enabled',
		);
	});

	test('hides the control from check-in-only staff without affecting registration review', async ({
		page,
		seedAdminUser,
	}) => {
		const checkin = defaultAdminAccount({ roles: ['checkin'] });
		await seedAdminUser(checkin);
		await page.goto('/');
		await fillAdminSignInForm(page, checkin);
		await page.click('#adminSignInButton');
		await expect(page).toHaveURL(/\/admin\/landing$/);
		await openReview(page);
		await expect(
			page.getByText('Casey Shopper', { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId('shopper-access-panel')).toHaveCount(0);
	});
});
