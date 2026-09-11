import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { E2E_PROGRAM_YEAR } from '../../fixtures/season';

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
		await expect(validationAlert).toContainText(
			'Complete the required fields',
		);
		await validationAlert
			.getByRole('button', { name: 'OK', exact: true })
			.click();

		await page.locator('.cm-content').fill('<p>Hello {{firstName}}</p>');
		await page
			.getByRole('button', { name: 'Save Revision', exact: true })
			.click();
		await expect(page).toHaveURL(
			/\/admin\/email-templates\/e2e-registration-template$/,
			{ timeout: 15000 },
		);
		const savedAlert = page.locator('ion-alert');
		await expect(savedAlert).toContainText('Revision r1 saved.', {
			timeout: 15000,
		});
		await savedAlert
			.getByRole('button', { name: 'OK', exact: true })
			.click();

		await page
			.locator('ion-input[formControlName="subjectPart"] input')
			.fill('Updated {{firstName}}');
		await page.locator('.cm-content').fill('<p>Updated {{firstName}}</p>');
		await page.locator('section.action-row ion-button').first().click();
		await expect(page.locator('ion-alert')).toContainText(
			'Revision r2 saved.',
			{
				timeout: 15000,
			},
		);
		await page
			.locator('ion-alert')
			.getByRole('button', { name: 'OK', exact: true })
			.click();
		await expect(
			page.getByText('Revision r2', { exact: true }),
		).toBeVisible();

		await page.locator('section.action-row ion-button').nth(3).click();
		const deleteAlert = page.locator('ion-alert');
		await deleteAlert
			.getByRole('button', { name: 'Delete', exact: true })
			.click();
		const deletedAlert = page.locator('ion-alert');
		await expect(deletedAlert).toContainText('was deleted.', {
			timeout: 15000,
		});
		await deletedAlert
			.getByRole('button', { name: 'OK', exact: true })
			.click();
		await expect(page).toHaveURL(/\/admin\/email-templates$/);
		await expect(
			page.getByText('No email templates yet.', { exact: false }),
		).toBeVisible();
	});

	test('EMAIL-003 imports, saves, reloads, and exports a Spanish template without publishing', async ({
		page,
	}) => {
		const bundle = JSON.parse(
			readFileSync(
				resolve(
					__dirname,
					`../../../santashop-admin/src/assets/email-templates/${E2E_PROGRAM_YEAR}/registration-confirmation-${E2E_PROGRAM_YEAR}-es.json`,
				),
				'utf8',
			),
		);
		bundle.template.key = `e2e-spanish-${E2E_PROGRAM_YEAR}`;
		bundle.template.awsTemplateName = `e2e-spanish-${E2E_PROGRAM_YEAR}`;
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/email-templates/create');
		await page
			.locator('#templateImport')
			.setInputFiles({
				name: 'spanish.json',
				mimeType: 'application/json',
				buffer: Buffer.from(JSON.stringify(bundle)),
			});
		await expect(
			page.locator('ion-select[formControlName="language"]'),
		).toHaveJSProperty('value', 'es');
		await expect(
			page.locator('ion-input[formControlName="subjectPart"] input'),
		).toHaveValue(bundle.template.subjectPart);
		await page
			.getByRole('button', { name: 'Save Revision', exact: true })
			.click();
		await expect(page.locator('ion-alert')).toContainText(
			'Revision r1 saved.',
			{ timeout: 15000 },
		);
		await page
			.locator('ion-alert')
			.getByRole('button', { name: 'OK', exact: true })
			.click();
		await page.reload();
		await expect(
			page.locator('ion-select[formControlName="language"]'),
		).toHaveJSProperty('value', 'es');
		await expect(
			page.locator(
				'ion-checkbox[formControlName="seasonalDetailsReviewed"]',
			),
		).toHaveJSProperty('checked', false);
		const jsonDownload = page.waitForEvent('download');
		await page
			.getByRole('button', { name: 'Export JSON', exact: true })
			.click();
		const exported = JSON.parse(
			readFileSync((await (await jsonDownload).path())!, 'utf8'),
		);
		expect(exported.template).toMatchObject({
			language: 'es',
			html: bundle.template.html,
			textPart: bundle.template.textPart,
			seasonalDetailsReviewed: false,
		});
		expect(exported.template.publishedRevisionId).toBeUndefined();
		const htmlDownload = page.waitForEvent('download');
		await page
			.getByRole('button', { name: 'Export HTML', exact: true })
			.click();
		expect(
			readFileSync((await (await htmlDownload).path())!, 'utf8'),
		).toContain('{{qrCodeUrl}}');
		await page
			.locator('#templateImport')
			.setInputFiles({
				name: 'invalid.json',
				mimeType: 'application/json',
				buffer: Buffer.from('{"version":99}'),
			});
		await expect(page.locator('ion-alert')).toContainText(
			'Unsupported template',
		);
		await page
			.locator('ion-alert')
			.getByRole('button', { name: 'OK', exact: true })
			.click();
		await expect(
			page.locator('ion-input[formControlName="subjectPart"] input'),
		).toHaveValue(bundle.template.subjectPart);
	});
});
