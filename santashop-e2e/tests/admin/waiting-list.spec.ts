import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultOwnerAccount,
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('owner waiting list tools', () => {
	test.beforeEach(async ({ clearData, seedPublicParams }) => {
		await clearData();
		await seedPublicParams({});
	});
	test('WAIT-OWNER-001 publishes independent flags and previews blocked campaigns without sending', async ({
		page,
		seedAdminUser,
	}) => {
		const owner = defaultOwnerAccount();
		await seedAdminUser(owner);
		await signInAdminViaUi(page, owner);
		await page.locator('#appSettingsNav').click();
		const settings = page.locator('admin-waiting-list-settings');
		await settings
			.getByText('Allow customers to join the waiting list', { exact: true })
			.click();
		await settings
			.getByRole('button', {
				name: 'Publish waiting list settings',
				exact: true,
			})
			.click();
		await expect(
			settings.getByText('Waiting list settings published.', { exact: true }),
		).toBeVisible();
		await page.reload();
		await expect(
			settings.locator('ion-toggle[formControlName="joiningEnabled"]'),
		).toHaveClass(/toggle-checked/);
		await expect(
			settings.locator('ion-toggle[formControlName="emailSendingEnabled"]'),
		).not.toHaveClass(/toggle-checked/);
		await page.goto('/admin/waiting-list');
		await expect(
			page.getByText('The waiting list is empty.', { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText('Publish English and Spanish waiting-list templates.', {
				exact: true,
			}),
		).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Send capacity emails', exact: true }),
		).toHaveCount(0);
	});
	test('WAIT-OWNER-002 denies the waiting-list tool to ordinary administrators', async ({
		page,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount({ owner: false });
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);
		await expect(page.locator('#waitingListNav')).toHaveCount(0);
		await page.goto('/admin/waiting-list');
		await expect(page).not.toHaveURL(/\/admin\/waiting-list$/);
	});
});
