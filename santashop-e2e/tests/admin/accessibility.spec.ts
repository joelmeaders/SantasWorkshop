import { expectNoBlockingAccessibilityViolations } from '../../fixtures/accessibility-helpers';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('staff critical-path accessibility', () => {
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});

	test('A11Y-ADMIN-001 has no blocking violations on sign-in', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.locator('#adminSignInButton')).toBeVisible({
			timeout: 15000,
		});

		await expectNoBlockingAccessibilityViolations(page);
	});

	test('A11Y-ADMIN-002 has no blocking violations in the staff workspace', async ({
		page,
		seedAdminUser,
		seedPublicParams,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);

		await expectNoBlockingAccessibilityViolations(page);
	});

	test('A11Y-ADMIN-003 has no blocking violations on a blocked scan warning', async ({
		page,
		seedAdminUser,
		seedPublicParams,
		seedRegistration,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await seedRegistration({
			uid: 'accessibility-duplicate-e2e',
			firstName: 'Accessible',
			lastName: 'Scanner',
			emailAddress: 'accessible.scanner-e2e@test.com',
			zipCode: '80202',
			code: 'A11YDUP1',
			dateTime: '2026-12-15T16:00:00.000Z',
			hasCheckedIn: true,
		});
		await signInAdminViaUi(page, account);
		await page.goto('/admin/checkin/scan');
		await page.locator('#manualCheckInCodeButton').click();
		const alert = page.locator('ion-alert');
		await expect(alert).toBeVisible();
		await alert.locator('input').fill('A11YDUP1');
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(
			page.getByText('Possible accidental double scan', { exact: true }),
		).toBeVisible({ timeout: 15000 });

		await expectNoBlockingAccessibilityViolations(page);
	});
});
