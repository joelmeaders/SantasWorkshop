import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { E2E_AUTH_EMULATOR_URL, E2E_PROJECT_ID } from '../../fixtures/season';

test.describe('admin self-service password recovery', () => {
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});
	test('recovers an existing staff account while public registration is under maintenance', async ({
		page,
		request,
		seedAdminUser,
		seedPublicParams,
	}) => {
		const account = defaultAdminAccount();
		await seedAdminUser(account);
		await seedPublicParams({ maintenanceModeEnabled: true });
		await page.goto('/');
		await page.getByText('Forgot your password?', { exact: true }).click();
		await expect(page).toHaveURL(/\/reset-password$/);
		await page.locator('#adminResetEmail input').fill(account.emailAddress);
		await page.locator('#adminResetEmail input').press('Enter');
		await expect(page.getByRole('status')).toContainText(
			'If an account exists',
			{ timeout: 15000 },
		);
		let resetLink = '';
		await expect
			.poll(
				async () => {
					const response = await request.get(
						E2E_AUTH_EMULATOR_URL +
							'/emulator/v1/projects/' +
							encodeURIComponent(E2E_PROJECT_ID) +
							'/oobCodes',
					);
					const payload = (await response.json()) as {
						oobCodes?: {
							email?: string;
							requestType?: string;
							oobLink?: string;
						}[];
					};
					resetLink =
						(payload.oobCodes ?? []).findLast(
							(code) =>
								code.email === account.emailAddress &&
								code.requestType === 'PASSWORD_RESET',
						)?.oobLink ?? '';
					return resetLink;
				},
				{ timeout: 15000 },
			)
			.toBeTruthy();
		const password = 'RecoveredStaff123!';
		const response = await request.get(
			resetLink + '&newPassword=' + encodeURIComponent(password),
		);
		expect(response.ok()).toBe(true);
		await signInAdminViaUi(page, { ...account, password });
	});
	test('acknowledges an unknown email without revealing account existence', async ({
		page,
	}) => {
		await page.goto('/reset-password');
		await page
			.locator('#adminResetEmail input')
			.fill('not-an-account@example.test');
		await page.locator('#adminResetButton').click();
		await expect(page.getByRole('status')).toContainText(
			'If an account exists',
			{ timeout: 15000 },
		);
		await expect(page.getByRole('status')).not.toContainText('not found');
		await page.getByText('Back to sign in', { exact: true }).click();
		await expect(page.locator('#adminSignInButton')).toBeVisible();
	});
});
