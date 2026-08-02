import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('admin email-template tools', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('EMAIL-001 opens the empty template manager and create-template route', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/email-templates');

		await expect(
			page.getByText(
				'No email templates yet. Create one to start managing SES-ready drafts.',
			),
		).toBeVisible({ timeout: 15000 });

		await page.getByTitle('Create template').click();
		await expect(page).toHaveURL(/\/admin\/email-templates\/create$/);
		await expect(
			page.getByText('Create Email Template', { exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Save Revision', exact: true }),
		).toBeDisabled();
	});

	test('EMAIL-002 creates, edits, validates, and deletes an email template', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/email-templates/create');

		await page
			.locator('ion-input[formControlName="key"] input')
			.fill('e2e-registration-template');
		await page
			.locator('ion-input[formControlName="displayName"] input')
			.fill('E2E Registration Template');
		await page
			.locator('ion-input[formControlName="awsTemplateName"] input')
			.fill('e2e-registration-template');
		await page
			.locator('ion-input[formControlName="subjectPart"] input')
			.fill('Hello {{firstName}}');

		await page.locator('section.action-row ion-button').first().click();
		const validationAlert = page.locator('ion-alert');
		await expect(validationAlert).toContainText('Complete the required fields');
		await validationAlert.getByRole('button', { name: 'OK', exact: true }).click();

		await page.locator('.cm-content').fill('<p>Hello {{firstName}}</p>');
		await page.getByRole('button', { name: 'Save Revision', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/email-templates\/e2e-registration-template$/);
		const savedAlert = page.locator('ion-alert');
		await expect(savedAlert).toContainText('Revision r1 saved.', { timeout: 15000 });
		await savedAlert.getByRole('button', { name: 'OK', exact: true }).click();

		await page.locator('ion-input[formControlName="subjectPart"] input').fill('Updated {{firstName}}');
		await page.locator('.cm-content').fill('<p>Updated {{firstName}}</p>');
		await page.locator('section.action-row ion-button').first().click();
		await expect(page.locator('ion-alert')).toContainText('Revision r2 saved.', {
			timeout: 15000,
		});
		await page.locator('ion-alert').getByRole('button', { name: 'OK', exact: true }).click();
		await expect(page.getByText('Revision r2', { exact: true })).toBeVisible();

		await page.locator('section.action-row ion-button').nth(3).click();
		const deleteAlert = page.locator('ion-alert');
		await deleteAlert.getByRole('button', { name: 'Delete', exact: true }).click();
		const deletedAlert = page.locator('ion-alert');
		await expect(deletedAlert).toContainText('was deleted.', { timeout: 15000 });
		await deletedAlert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/email-templates$/);
		await expect(page.getByText('No email templates yet.', { exact: false })).toBeVisible();
	});
});
