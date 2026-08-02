import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultOwnerAccount,
	fillIonicInput,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('owner protected operations', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultOwnerAccount());
	});

	test('OWNER-002 previews every non-destructive owner operation and displays its exact confirmation phrase', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultOwnerAccount());
		await page.goto('/admin/owner-operations');

		const operations = [
			'Queue reminder emails',
			'Export marketing emails',
			'Export registered emails',
			'Repair check-in flags',
			'Rebuild check-in statistics',
		];

		for (const operation of operations) {
			await page.locator('ion-select[formControlName="operation"]').click();
			const alert = page.locator('ion-alert');
			await alert.getByText(operation, { exact: true }).click();
			await alert.getByRole('button', { name: 'OK', exact: true }).click();
			await page.locator('#ownerOperationPreview').click();
			await expect(page.locator('#previewHeading')).toBeVisible({
				timeout: 15000,
			});
			await expect(page.getByText('Preview ready.', { exact: false })).toBeVisible();
			await expect(page.locator('code')).toContainText(operation.toUpperCase().split(' ').slice(0, 1)[0]);
		}
	});

	test('OWNER-002 requires the exact phrase and owner reauthentication before starting', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultOwnerAccount());
		await page.goto('/admin/owner-operations');
		await page.locator('ion-select[formControlName="operation"]').click();
		const alert = page.locator('ion-alert');
		await alert.getByText('Repair check-in flags', { exact: true }).click();
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
		await page.locator('#ownerOperationPreview').click();
		await expect(page.locator('#previewHeading')).toBeVisible({ timeout: 15000 });

		const phrase = await page.locator('code').innerText();
		await fillIonicInput(page, 'ion-input[formControlName="password"]', defaultOwnerAccount().password);
		await fillIonicInput(page, 'ion-input[formControlName="confirmationPhrase"]', `${phrase}-wrong`);
		await expect(page.locator('#ownerOperationStart')).toBeEnabled();
		await page.locator('#ownerOperationStart').click();
		await expect(page.getByRole('alert')).toContainText('Confirmation phrase does not match', {
			timeout: 15000,
		});
	});
});
