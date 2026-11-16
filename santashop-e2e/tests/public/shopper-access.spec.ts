import { test, expect } from '../../fixtures/test-fixtures';
import {
	createAccountViaUi,
	randomAccount,
} from '../../fixtures/account-helpers';
import { defaultOwnerAccount } from '../../fixtures/admin-helpers';
import {
	E2E_AUTH_EMULATOR_URL,
	E2E_FUNCTIONS_EMULATOR_URL,
	E2E_PROJECT_ID,
	e2eDateTime,
} from '../../fixtures/season';

test('disabling a shopper ends their current session and re-enabling restores access', async ({
	page,
	request,
	clearData,
	seedScenario,
	seedAdminUser,
	inspectRegistrationBoundary,
	seedRegistration,
}) => {
	test.setTimeout(90_000);
	await clearData();
	await seedScenario('create-account-enabled');
	const owner = defaultOwnerAccount();
	await seedAdminUser(owner);
	const shopper = randomAccount();
	await createAccountViaUi(page, shopper);
	await expect(page.locator('#children-heading')).toBeVisible();
	const { uid } = await inspectRegistrationBoundary(shopper.emailAddress);
	await seedRegistration({
		...shopper,
		uid,
		code: 'E2EACC01',
		dateTime: e2eDateTime(12, 15, 16),
	});
	const before = await inspectRegistrationBoundary(shopper.emailAddress);
	expect(before.registration.registrationSubmittedOn).not.toBeNull();

	// The existing emulator fixture creates a real Firebase owner account.
	expect(E2E_PROJECT_ID).toBe('demo-santashop');
	for (const url of [E2E_AUTH_EMULATOR_URL, E2E_FUNCTIONS_EMULATOR_URL]) {
		expect(new URL(url).hostname).toBe('127.0.0.1');
	}
	const login = await request.post(
		E2E_AUTH_EMULATOR_URL +
			'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
		{
			data: {
				email: owner.emailAddress,
				password: owner.password,
				returnSecureToken: true,
			},
		},
	);
	expect(login.ok()).toBe(true);
	const { idToken } = (await login.json()) as { idToken: string };
	const setAccess = async (disabled: boolean): Promise<void> => {
		const response = await request.post(
			E2E_FUNCTIONS_EMULATOR_URL + '/callableSetShopperAccess',
			{
				headers: { Authorization: `Bearer ${idToken}` },
				data: {
					data: {
						uid: before.uid,
						disabled,
						...(disabled
							? { reason: 'duplicate-registration' }
							: {}),
					},
				},
			},
		);
		expect(response.ok(), await response.text()).toBe(true);
	};

	await setAccess(true);
	const modal = page.locator('ion-modal#shopper-access-disabled');
	await expect(modal.getByText('Your account has been disabled')).toBeVisible(
		{ timeout: 45_000 },
	);
	await expect(
		modal.getByText('president@denversantaclausshop.org'),
	).toBeVisible();
	await expect(
		modal.getByRole('button', { name: 'Copy email address' }),
	).toBeVisible();
	await expect(
		modal.getByText(/cancel your current registration/),
	).toBeVisible();
	await modal.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(page.locator('#children-heading')).not.toBeVisible();

	await page.goto('/?mode=sign-in');
	await page.locator('#signInEmail input').fill(shopper.emailAddress);
	await page.locator('#signInPassword input').fill(shopper.password);
	await page.locator('#signInButton').click();
	await expect(
		modal.getByText('Your account has been disabled'),
	).toBeVisible();
	await modal.getByRole('button', { name: 'Close', exact: true }).click();

	await setAccess(false);
	await page.locator('#signInEmail input').fill(shopper.emailAddress);
	await page.locator('#signInPassword input').fill(shopper.password);
	await page.locator('#signInButton').click();
	await expect(page).toHaveURL(/\/pre-registration\/confirmation$/);
	const after = await inspectRegistrationBoundary(shopper.emailAddress);
	expect(after.registrationCount).toBe(before.registrationCount);
	expect(after.emailCount).toBe(before.emailCount);
	expect(after.registration.cancelledOn).toBeNull();
	expect(after.qrPaths).toEqual(before.qrPaths);
});
