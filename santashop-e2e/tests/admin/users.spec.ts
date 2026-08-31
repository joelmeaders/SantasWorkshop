import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultOwnerAccount,
	fillAdminSignInForm,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('admin staff user management', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultOwnerAccount());
	});

	test('USER-001 creates a check-in staff account from the user manager', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultOwnerAccount());
		await page.goto('/admin/users');
		await expect(
			page.getByText(
				'No elevated user accounts yet. Use the button below to add one.',
			),
		).toBeVisible({ timeout: 15000 });

		await page.getByTitle('Add user').click();
		const modal = page.locator('ion-modal');
		await expect(modal).toBeVisible();
		await expect(modal.getByText('New User', { exact: true })).toBeVisible();

		await modal
			.locator('ion-input[formControlName="emailAddress"] input')
			.fill('operator-e2e@test.com');
		await modal
			.locator('ion-input[formControlName="displayName"] input')
			.fill('E2E Operator');
		await modal
			.locator('ion-input[formControlName="password"] input')
			.fill('Test1234!');

		await modal.locator('ion-select[formControlName="roles"]').click();
		const roleAlert = page.locator('ion-alert');
		await expect(roleAlert).toBeVisible();
		await roleAlert.getByText('Check-In', { exact: true }).click();
		await roleAlert.getByRole('button', { name: 'OK', exact: true }).click();

		await modal.getByRole('button', { name: 'Create user', exact: true }).click();
		const resultAlert = page.locator('ion-alert');
		await expect(resultAlert).toContainText('User created.', {
			timeout: 15000,
		});
		await resultAlert.getByRole('button', { name: 'OK', exact: true }).click();

		await expect(page.locator('ion-item')).toContainText('E2E Operator', {
			timeout: 15000,
		});
		await expect(page.locator('ion-item')).toContainText('Check-In');
	});

	test('USER-002 edits a permitted staff role, disables the account, and removes it', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultOwnerAccount());
		await page.goto('/admin/users');
		await page.getByTitle('Add user').click();
		const createModal = page.locator('ion-modal');
		await createModal
			.locator('ion-input[formControlName="emailAddress"] input')
			.fill('managed-staff-e2e@test.com');
		await createModal
			.locator('ion-input[formControlName="displayName"] input')
			.fill('Managed Staff');
		await createModal
			.locator('ion-input[formControlName="password"] input')
			.fill('Test1234!');
		await createModal.locator('ion-select[formControlName="roles"]').click();
		const createRoleAlert = page.locator('ion-alert');
		await createRoleAlert.getByText('Check-In', { exact: true }).click();
		await createRoleAlert.getByRole('button', { name: 'OK', exact: true }).click();
		await createModal.getByRole('button', { name: 'Create user', exact: true }).click();
		const createdAlert = page.locator('ion-alert');
		await expect(createdAlert).toContainText('User created.', { timeout: 15000 });
		await createdAlert.getByRole('button', { name: 'OK', exact: true }).click();

		const accountItem = page.locator('ion-item').filter({
			hasText: 'managed-staff-e2e@test.com',
		});
		await expect(accountItem).toContainText('Check-In');
		await accountItem.getByTitle('Edit user').click();
		const modal = page.locator('ion-modal');
		await modal.locator('ion-select[formControlName="roles"]').click();
		const roleAlert = page.locator('ion-alert');
		await roleAlert.getByText('Administrator', { exact: true }).click();
		await roleAlert.getByRole('button', { name: 'OK', exact: true }).click();
		await modal.locator('ion-toggle[formControlName="disabled"]').click();
		await modal.getByRole('button', { name: 'Save changes', exact: true }).click();

		const savedAlert = page.locator('ion-alert');
		await expect(savedAlert).toContainText('Changes saved.', { timeout: 15000 });
		await savedAlert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(accountItem).toContainText('Administrator');
		await expect(accountItem).toContainText('Disabled');

		await accountItem.getByTitle('Delete user').click();
		const deleteAlert = page.locator('ion-alert');
		await deleteAlert.getByRole('button', { name: 'Delete', exact: true }).click();
		const deletedAlert = page.locator('ion-alert');
		await expect(deletedAlert).toContainText('User deleted.', { timeout: 15000 });
		await deletedAlert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(
			page.locator('ion-item').filter({ hasText: 'managed-staff-e2e@test.com' }),
		).toHaveCount(0);
	});

	test('USER-003 resets a staff password and accepts the replacement credential', async ({
		page,
	}) => {
		const emailAddress = 'password-reset-staff-e2e@test.com';
		const originalPassword = 'Test1234!';
		const replacementPassword = 'Changed1234!';
		await signInAdminViaUi(page, defaultOwnerAccount());
		await page.goto('/admin/users');
		await page.getByTitle('Add user').click();
		const createModal = page.locator('ion-modal');
		await createModal
			.locator('ion-input[formControlName="emailAddress"] input')
			.fill(emailAddress);
		await createModal
			.locator('ion-input[formControlName="displayName"] input')
			.fill('Password Reset Staff');
		await createModal
			.locator('ion-input[formControlName="password"] input')
			.fill(originalPassword);
		await createModal.locator('ion-select[formControlName="roles"]').click();
		const roleAlert = page.locator('ion-alert');
		await roleAlert.getByText('Check-In', { exact: true }).click();
		await roleAlert.getByRole('button', { name: 'OK', exact: true }).click();
		await createModal
			.getByRole('button', { name: 'Create user', exact: true })
			.click();
		const createdAlert = page.locator('ion-alert');
		await expect(createdAlert).toContainText('User created.', {
			timeout: 15000,
		});
		await createdAlert.getByRole('button', { name: 'OK', exact: true }).click();

		const accountItem = page.locator('ion-item').filter({ hasText: emailAddress });
		await accountItem.getByTitle('Reset password').click();
		const resetAlert = page
			.locator('ion-alert')
			.filter({ hasText: 'Reset Password' });
		await expect(resetAlert).toContainText('Reset Password');
		await resetAlert.locator('input').fill(replacementPassword);
		await resetAlert
			.getByRole('button', { name: 'Save', exact: true })
			.click();
		const resultAlert = page
			.locator('ion-alert')
			.filter({ hasText: 'Password updated.' });
		await expect(resultAlert).toContainText('Password updated.', {
			timeout: 15000,
		});
		await resultAlert.getByRole('button', { name: 'OK', exact: true }).click();

		await page.goto('/admin/landing');
		await page.locator('#adminSignOutButton').click();
		await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
		await fillAdminSignInForm(page, {
			emailAddress,
			password: replacementPassword,
		});
		await page.locator('#adminSignInButton').click();
		await expect(page).toHaveURL(/\/admin\/landing$/, { timeout: 30000 });
		await expect(page.locator('#checkInNav')).toBeVisible();
		await expect(page.locator('#scheduleEditorNav')).toHaveCount(0);
	});
});
