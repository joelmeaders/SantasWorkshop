import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	randomAccount,
} from '../../fixtures/account-helpers';
import {
	addChildViaUi,
	defaultTestChild,
	selectAppointmentViaUi,
} from '../../fixtures/registration-helpers';
import {
	E2E_FUNCTIONS_EMULATOR_URL,
	E2E_PROGRAM_YEAR,
	e2eDateTime,
} from '../../fixtures/season';

const flags = async (
	request: APIRequestContext,
	joiningEnabled: boolean,
): Promise<void> => {
	const response = await request.post(
		`${E2E_FUNCTIONS_EMULATOR_URL}/testSeedWaitingListSettings`,
		{ data: { data: { joiningEnabled, emailSendingEnabled: false } } },
	);
	expect(response.ok()).toBe(true);
};

test.describe('optional waiting list', () => {
	test.beforeEach(async ({ clearData, seedScenario, request }) => {
		await clearData();
		await seedScenario('create-account-enabled');
		await flags(request, true);
	});

	test('WAIT-001 requires consent, persists membership, permits opt-out while disabled, and clears membership after booking', async ({
		page,
		request,
		seedDateTimeSlots,
	}) => {
		await createAccountViaUi(page, randomAccount());
		const card = page.locator('app-waiting-list');
		const join = card.locator('#joinWaitingListButton');
		await expect(join).toHaveClass(/button-disabled/);
		await card.locator('input[type="checkbox"]').check();
		await join.click();
		await expect(
			card.getByText('You joined the waiting list.', { exact: true }),
		).toBeVisible();
		await flags(request, false);
		await page.reload();
		await card.locator('#leaveWaitingListButton').click();
		await expect(
			card.getByText('You left the waiting list.', { exact: true }),
		).toBeVisible();
		await expect(join).toHaveCount(0);
		await flags(request, true);
		await page.reload();
		await card.locator('input[type="checkbox"]').check();
		await join.click();
		await expect(card.locator('#leaveWaitingListButton')).toBeVisible();
		await seedDateTimeSlots([
			{
				id: 'waiting-capacity',
				programYear: E2E_PROGRAM_YEAR,
				dateTime: e2eDateTime(12, 12, 16),
				maxSlots: 10,
				slotsReserved: 0,
				enabled: true,
			},
		]);
		await page.reload();
		await addChildViaUi(page, defaultTestChild());
		await selectAppointmentViaUi(page, 'waiting-capacity');
		await expect(card.locator('#leaveWaitingListButton')).toHaveCount(0);
		await page.reload();
		await expect(card.getByRole('button')).toHaveCount(0);
	});

	for (const source of [
		'maintenance',
		'weather',
		'registration-closed',
	] as const) {
		test(`WAIT-OVERLAY-${source} signs in an existing customer while the closure remains visible`, async ({
			page,
			browser,
			request,
			seedPublicParams,
		}) => {
			const account = randomAccount();
			await createAccountViaUi(page, account);
			await seedPublicParams(
				source === 'maintenance'
					? { maintenanceModeEnabled: true }
					: source === 'weather'
						? { weatherModeEnabled: true }
						: { registrationEnabled: false },
			);
			const context = await browser.newContext({
				baseURL: 'http://localhost:4100',
			});
			try {
				const guest = await context.newPage();
				await guest.goto('/');
				const overlay = guest.locator('ion-modal app-operational-notice');
				await expect(overlay).toBeVisible();
				await overlay
					.locator('ion-button')
					.filter({ hasText: /^Sign In$/ })
					.click();
				await overlay
					.locator('ion-input[type="email"] input')
					.fill(account.emailAddress);
				await overlay
					.locator('ion-input[type="password"] input')
					.fill(account.password);
				await overlay
					.locator('ion-button')
					.filter({ hasText: /^Sign In$/ })
					.click();
				await expect(overlay.locator('input[type="checkbox"]')).toBeVisible();
				await overlay.locator('input[type="checkbox"]').check();
				await overlay.locator('#joinWaitingListButton').click();
				await expect(overlay.locator('#leaveWaitingListButton')).toBeVisible();
				await expect(overlay).toBeVisible();
				await flags(request, false);
				const manageContext = await browser.newContext({ baseURL: 'http://localhost:4100' });
				try {
					const manage = await manageContext.newPage();
					await manage.goto('/?mode=sign-in&waitingList=manage');
					const notice = manage.locator('ion-modal app-operational-notice');
					await notice.locator('ion-button').filter({ hasText: /^Sign In$/ }).click();
					await notice.locator('ion-input[type="email"] input').fill(account.emailAddress);
					await notice.locator('ion-input[type="password"] input').fill(account.password);
					await notice.locator('ion-button').filter({ hasText: /^Sign In$/ }).click();
					await notice.locator('#leaveWaitingListButton').click();
					await expect(notice.getByText('You left the waiting list.', { exact: true })).toBeVisible();
					await expect(notice.locator('#joinWaitingListButton')).toHaveCount(0);
				} finally { await manageContext.close(); }
			} finally {
				await context.close();
			}
		});
	}
});
