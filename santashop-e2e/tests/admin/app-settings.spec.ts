import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	defaultOwnerAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { E2E_FUNCTIONS_EMULATOR_URL } from '../../fixtures/season';

test.describe('owner public settings', () => {
	test.beforeEach(async ({ clearData, seedPublicParams }) => {
		await clearData();
		await seedPublicParams({});
	});

	test('SETTINGS-001 publishes a flag and bilingual messages to the emulator configuration', async ({
		page,
		seedAdminUser,
		request,
	}) => {
		const account = defaultOwnerAccount();
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);
		await page.locator('#appSettingsNav').click();
		await expect(page).toHaveURL(/\/admin\/app-settings$/);
		const message = page.getByRole('textbox', {
			name: 'Customer message (English)',
			exact: true,
		});
		await message.fill('E2E updated English message');
		await page
			.getByRole('textbox', {
				name: 'Customer message (Spanish)',
				exact: true,
			})
			.fill('E2E mensaje actualizado');
		await page
			.locator('ion-toggle[formControlName="createAccountEnabled"]')
			.click();
		await page
			.getByRole('button', { name: 'Publish', exact: true })
			.click();
		await expect(page.getByRole('status')).toContainText(
			/Published version \d+\./,
		);
		await expect
			.poll(async () => {
				const response = await request.post(
					`${E2E_FUNCTIONS_EMULATOR_URL}/testReadPublicParameters`,
					{ data: { data: {} } },
				);
				expect(response.ok()).toBeTruthy();
				return (await response.json()).result;
			})
			.toMatchObject({
				createAccountEnabled: false,
				messageEn: 'E2E updated English message',
				messageEs: 'E2E mensaje actualizado',
			});
		await page.reload();
		await expect(message).toHaveValue('E2E updated English message');
	});

	test('SETTINGS-002 denies the settings route to an ordinary admin', async ({
		page,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount({ owner: false });
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);
		await expect(page.locator('#appSettingsNav')).toHaveCount(0);
		await page.goto('/admin/app-settings');
		await expect(page).toHaveURL(/\/admin\/landing$/);
		await expect(
			page.getByRole('button', { name: 'Publish', exact: true }),
		).toHaveCount(0);
	});

	test('SETTINGS-003 keeps unsaved edits when another publisher changes settings', async ({
		page,
		seedAdminUser,
		seedPublicParams,
	}) => {
		const account = defaultOwnerAccount();
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);
		await page.locator('#appSettingsNav').click();
		const message = page.getByRole('textbox', {
			name: 'Customer message (English)',
			exact: true,
		});
		await message.fill('My unsaved message');
		await seedPublicParams({ messageEn: 'Another publisher' });
		await page
			.getByRole('button', { name: 'Publish', exact: true })
			.click();
		await expect(page.getByRole('alert')).toContainText(
			'Settings changed since you loaded them',
		);
		await expect(message).toHaveValue('My unsaved message');
	});
});
