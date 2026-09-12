import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultOwnerAccount,
	fillIonicInput,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

async function prepareRepair(page: Page): Promise<void> {
	await signInAdminViaUi(page, defaultOwnerAccount());
	await page.goto('/admin/owner-operations');
	await page.locator('ion-select[formControlName="operation"]').click();
	const picker = page.locator('ion-alert');
	await picker
		.getByRole('radio', { name: 'Repair check-in flags', exact: true })
		.click();
	await picker.getByRole('button', { name: 'OK', exact: true }).click();
	await page.locator('#ownerOperationPreview').click();
	await expect(page.locator('#previewHeading')).toBeVisible();
	const phrase = await page.locator('code').innerText();
	await fillIonicInput(
		page,
		'ion-input[formControlName="password"]',
		defaultOwnerAccount().password,
	);
	await fillIonicInput(
		page,
		'ion-input[formControlName="confirmationPhrase"]',
		phrase,
	);
}

test.describe('owner authorization and polling recovery', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultOwnerAccount());
	});

	test('OWNER-005 refreshes the same job after a status request fails', async ({
		page,
	}) => {
		await prepareRepair(page);
		let starts = 0;
		const polledIds: string[] = [];
		page.on('request', (request) => {
			if (request.method() !== 'POST') return;
			if (request.url().endsWith('/callableStartOwnerOperation'))
				starts++;
			if (request.url().endsWith('/callableGetOwnerOperation')) {
				polledIds.push(
					(
						request.postDataJSON() as {
							data: { operationId: string };
						}
					).data.operationId,
				);
			}
		});
		// The job starts in the emulator. Only its first status response is unavailable.
		await page.route(
			'**/us-central1/callableGetOwnerOperation',
			(route) => route.abort('connectionreset'),
			{ times: 1 },
		);
		await page.locator('#ownerOperationStart').click();
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(
			page.getByRole('button', {
				name: 'Start protected operation',
				exact: true,
			}),
		).toBeDisabled();
		await page
			.getByRole('button', {
				name: 'Refresh operation status',
				exact: true,
			})
			.click();
		await expect(
			page.getByText('Status: Completed', { exact: true }),
		).toBeVisible({ timeout: 15000 });
		await expect(page.getByRole('alert')).toHaveCount(0);
		expect(starts).toBe(1);
		expect(polledIds.length).toBeGreaterThanOrEqual(2);
		expect(new Set(polledIds).size).toBe(1);
	});

	test('OWNER-006 revoked owner access is rejected when an open page reauthenticates to start', async ({
		page,
		seedAdminUser,
	}) => {
		await prepareRepair(page);
		// Change real Auth emulator claims after the preview; do not replace tokens in the browser.
		await seedAdminUser(defaultOwnerAccount({ owner: false }));
		const rejected = page.waitForResponse(
			(response) =>
				response.url().endsWith('/callableStartOwnerOperation') &&
				response.request().method() === 'POST',
		);
		await page.locator('#ownerOperationStart').click();
		expect((await rejected).status()).toBe(403);
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(
			page.getByText('Status: Completed', { exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole('button', {
				name: 'Refresh operation status',
				exact: true,
			}),
		).toHaveCount(0);
		await page.goto('/admin/owner-operations');
		await expect(page).not.toHaveURL(/\/admin\/owner-operations$/);
	});
});
