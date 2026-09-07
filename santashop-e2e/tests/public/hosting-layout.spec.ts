import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	randomAccount,
} from '../../fixtures/account-helpers';

for (const viewport of [
	{ width: 1365, height: 900 },
	{ width: 390, height: 844 },
]) {
	test(`LAYOUT-001 keeps the registration header and maintenance notice within ${viewport.width}px`, async ({
		page,
		clearData,
		seedScenario,
		seedPublicParams,
	}, testInfo) => {
		await page.setViewportSize(viewport);
		await clearData();
		await seedScenario('create-account-enabled');
		await createAccountViaUi(page, randomAccount());
		const logo = page.locator('ion-header .sm-logo');
		await expect(logo).toBeVisible();
		const logoBounds = await logo.boundingBox();
		expect(logoBounds).not.toBeNull();
		expect(logoBounds?.width).toBeLessThan(80);
		expect(logoBounds?.height).toBeLessThan(80);
		const headerBounds = await page.locator('ion-header').boundingBox();
		expect(headerBounds?.height).toBeLessThan(100);
		await page.screenshot({
			path: testInfo.outputPath('registration-layout.png'),
		});

		await seedPublicParams({ maintenanceModeEnabled: true });
		await page.reload();
		const notice = page.locator('ion-modal app-operational-notice');
		await expect(notice).toBeVisible({ timeout: 15000 });
		const modal = page.locator('ion-modal.show-modal .modal-wrapper');
		await expect(modal).toBeVisible();
		await expect
			.poll(async () => {
				const bounds = await modal.boundingBox();
				return (
					bounds &&
					bounds.y >= 0 &&
					bounds.y + bounds.height <= viewport.height + 1 &&
					bounds.x >= 0 &&
					bounds.x + bounds.width <= viewport.width + 1
				);
			})
			.toBe(true);
		await page.screenshot({
			path: testInfo.outputPath('maintenance-layout.png'),
		});
	});
}
