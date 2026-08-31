import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	fillIonicInput,
	fillAdminSignInForm,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

const scanManualCode = async (page: import('@playwright/test').Page, code: string): Promise<void> => {
	await page.goto('/admin/checkin/scan');
	await page.locator('#manualCheckInCodeButton').click();
	const alert = page.locator('ion-alert').last();
	await expect(alert).toBeVisible();
	await alert.locator('input').fill(code);
	await alert.getByRole('button', { name: 'OK', exact: true }).click();
};

const registration = {
	uid: 'checkin-registration-e2e',
	firstName: 'Casey',
	lastName: 'Checkin',
	emailAddress: 'casey.checkin-e2e@test.com',
	zipCode: '80202',
	code: 'E2ECHK01',
	dateTime: '2026-12-15T16:00:00.000Z',
};

test.describe('check-in and staff registration operations', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('CHECKIN-010 completes a valid manual-code check-in', async ({ page, seedRegistration }) => {
		await seedRegistration(registration);
		await signInAdminViaUi(page, defaultAdminAccount());
		const pageErrors: string[] = [];
		page.on('pageerror', (error) => pageErrors.push(error.message));
		await page.goto('/admin/checkin/scan');
		await expect(page).toHaveURL(/\/admin\/checkin\/scan$/);
		if (pageErrors.length) throw new Error(pageErrors.join('\n'));
		await page.locator('#manualCheckInCodeButton').click();
		const alert = page.locator('ion-alert').last();
		await expect(alert).toBeVisible();
		await alert.locator('input').fill(registration.code);
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/review$/);
		await expect(page.getByText('Casey Checkin', { exact: true })).toBeVisible();
		await page.getByText('Yes, check in', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/confirmation$/);
		await expect(page.getByText('Give the shopper 1 coupons.')).toBeVisible();
	});

	test('CHECKIN-005 presents a scanned registration for staff review before normal confirmation', async ({ page, seedRegistration }) => {
		await seedRegistration(registration);
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/checkin/scan');
		await page.locator('#manualCheckInCodeButton').click();
		const alert = page.locator('ion-alert').last();
		await alert.locator('input').fill(registration.code);
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/review$/);
		await expect(page.getByText('Review all registration information.')).toBeVisible();
		await expect(page.getByText('Test Child', { exact: true })).toBeVisible();
		await expect(page.getByText('Yes, check in', { exact: true })).toBeVisible();
		await page.getByText('Yes, check in', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/confirmation$/);
	});

	test('CHECKIN-004 keeps an unknown manual code out of check-in and offers staff lookup recovery', async ({ page }) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await scanManualCode(page, 'MISSING1');
		const alert = page.locator('ion-alert').last();
		await expect(alert).toContainText('That registration could not be found');
		await expect(page).not.toHaveURL(/\/admin\/checkin\/(review|confirmation)/);
		await alert.getByRole('button', { name: 'Try Search', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/search$/);
		await expect(page.getByTitle('Search').locator('ion-title')).toHaveText('Search');
	});

	test('CHECKIN-INCOMPLETE-001 blocks an incomplete manual-code match and offers lookup recovery', async ({
		page,
		seedRegistration,
	}) => {
		await seedRegistration({
			...registration,
			uid: 'incomplete-checkin-e2e',
			code: 'E2EINC01',
			incomplete: true,
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await scanManualCode(page, 'E2EINC01');
		const alert = page.locator('ion-alert').last();
		await expect(alert).toContainText('That registration is incomplete and cannot be checked in.');
		await expect(page).not.toHaveURL(/\/admin\/checkin\/(review|confirmation)/);
		await alert.getByRole('button', { name: 'Try Search', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/search$/);
	});

	test('CHECKIN-007A blocks a likely accidental rescan immediately', async ({ page, seedRegistration }) => {
		await seedRegistration({ ...registration, uid: 'duplicate-checkin-e2e', code: 'E2EDUP01', hasCheckedIn: true });
		await signInAdminViaUi(page, defaultAdminAccount());
		await scanManualCode(page, 'E2EDUP01');
		await expect(page).toHaveURL(/\/admin\/checkin\/duplicate\/duplicate-checkin-e2e$/);
		await expect(page.getByText('Possible accidental double scan')).toBeVisible();
		await expect(page.getByText('Do not issue tickets or coupons.')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Current blocked attempt' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Original successful check-in' })).toBeVisible();
		await expect(page.getByText('Code ending in UP01', { exact: true })).toBeVisible();
		await expect(page.getByText(/seconds before this attempt/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Start Over', exact: true })).toBeVisible();
		await expect(page.getByText(/coupons?/i).filter({ hasNotText: 'Do not issue tickets or coupons.' })).toHaveCount(0);
	});

	test('CHECKIN-007B adds a late duplicate to the admin scan risk review', async ({ page, seedRegistration }) => {
		await seedRegistration({
			...registration,
			uid: 'late-duplicate-e2e',
			code: 'E2ELATE1',
			hasCheckedIn: true,
			checkInDateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await scanManualCode(page, 'E2ELATE1');
		await expect(page.getByText('Suspicious duplicate scan')).toBeVisible();
		await expect(page.getByText('Contact a DSCS member to resolve this attempt.')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Current blocked attempt' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Original successful check-in' })).toBeVisible();
		await expect(page.getByText('Code ending in ATE1', { exact: true })).toBeVisible();
		await expect(page.getByText(/seconds before this attempt/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Start Over', exact: true })).toBeVisible();
		await page.goto('/admin/stats/scan-risk');
		await expect(page.getByText('Casey Checkin', { exact: true })).toBeVisible();
		await expect(page.getByText(/Late duplicate 1/)).toBeVisible();
		await page.getByText('Casey Checkin', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/stats\/scan-risk\/late-duplicate-e2e$/);
		await expect(page.getByText('Successful check-in', { exact: true })).toBeVisible();
		await expect(page.getByText('duplicate-risk', { exact: true })).toBeVisible();
	});

	test('CHECKIN-007C keeps a cancelled code blocked, then permits a re-registered replacement exactly once', async ({
		page,
		seedRegistration,
	}) => {
		const cancelled = {
			supersededCode: 'E2EOLD01',
			cancelledOn: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
		};
		await seedRegistration({
			...registration,
			uid: 'cancelled-registration-e2e',
			code: 'E2ENEW01',
			cancellation: cancelled,
		});
		await signInAdminViaUi(page, defaultAdminAccount());

		await scanManualCode(page, 'E2EOLD01');
		await expect(page.getByText('Canceled registration code', { exact: true })).toBeVisible();
		await expect(page.getByText('Contact a DSCS member to resolve this attempt.')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Current blocked attempt' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Registration canceled' })).toBeVisible();
		await expect(page.getByText('Code ending in LD01', { exact: true })).toBeVisible();
		await expect(page.getByText(/seconds before this attempt/)).toBeVisible();
		await page.getByRole('button', { name: 'Start Over', exact: true }).click();
		await scanManualCode(page, 'E2ENEW01');
		await expect(page.getByText('Canceled registration code', { exact: true })).toBeVisible();
		await expect(page.getByText('Do not issue tickets or coupons.')).toBeVisible();

		await seedRegistration({
			...registration,
			uid: 'cancelled-registration-e2e',
			code: 'E2ENEW01',
			cancellation: { ...cancelled, reRegistered: true },
		});
		await scanManualCode(page, 'E2ENEW01');
		await expect(page).toHaveURL(/\/admin\/checkin\/review$/);
		await page.getByText('Yes, check in', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/confirmation$/);

		await seedRegistration({
			...registration,
			uid: 'cancelled-registration-e2e',
			code: 'E2ENEW01',
			cancellation: { ...cancelled, reRegistered: true },
			hasCheckedIn: true,
			checkInDateTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
		});
		await scanManualCode(page, 'E2ENEW01');
		await expect(page.getByText('Suspicious duplicate scan', { exact: true })).toBeVisible();

		await page.goto('/admin/stats/scan-risk');
		await expect(page.getByText(/3 risk attempt/)).toBeVisible();
		await expect(page.getByText(/Canceled code 2/)).toBeVisible();
		await expect(page.getByText(/Late duplicate 1/)).toBeVisible();
		await page.getByText('Casey Checkin', { exact: true }).click();
		await expect(page.getByText('cancelled', { exact: true })).toHaveCount(2);
		await expect(page.getByText('duplicate-risk', { exact: true })).toHaveCount(1);
	});

	test('STAFF-007 denies scan risk review to check-in-only staff', async ({
		page,
		seedAdminUser,
	}) => {
		const checkInAccount = defaultAdminAccount({
			uid: 'checkin-only-e2e',
			emailAddress: 'checkin-only-e2e@test.com',
			admin: false,
			roles: ['checkin'],
		});
		await seedAdminUser(checkInAccount);
		await page.goto('/');
		await fillAdminSignInForm(page, checkInAccount);
		await page.locator('#adminSignInButton').click();
		await page.waitForURL('**/admin/landing', { timeout: 30000 });
		await expect(page.locator('#checkInNav')).toBeVisible();
		await expect(page.locator('#scanRiskReviewNav')).toHaveCount(0);

		await page.goto('/admin/stats/scan-risk');
		await expect(page).not.toHaveURL(/\/admin\/stats\/scan-risk/);
		await expect(page.locator('#checkInNav')).toBeVisible({ timeout: 15000 });
	});

	test('SCAN-RISK-001 paginates current-season risk summaries and keeps each customer timeline newest first', async ({
		page,
		seedScanRiskHistory,
	}) => {
		await seedScanRiskHistory({
			summaries: [
				{
					customerId: 'scan-mixed-e2e',
					firstName: 'Mixed',
					lastName: 'Attempts',
					emailAddress: 'mixed.attempts-e2e@test.com',
					firstRiskOn: '2026-12-18T16:00:00.000Z',
					latestRiskOn: '2026-12-20T16:00:00.000Z',
					lateDuplicateAttemptCount: 2,
					cancelledCodeAttemptCount: 2,
					totalRiskAttemptCount: 4,
					originalCheckInOn: '2026-12-15T16:00:00.000Z',
				},
				...Array.from({ length: 20 }, (_, index) => ({
					customerId: `scan-page-${index + 1}-e2e`,
					firstName: 'Paged',
					lastName: `Customer ${index + 1}`,
					emailAddress: `scan-page-${index + 1}-e2e@test.com`,
					firstRiskOn: `2026-12-19T${String(23 - index).padStart(2, '0')}:00:00.000Z`,
					latestRiskOn: `2026-12-19T${String(23 - index).padStart(2, '0')}:30:00.000Z`,
					lateDuplicateAttemptCount: 1,
					totalRiskAttemptCount: 1,
				})),
				{
					customerId: 'prior-season-scan-e2e',
					firstName: 'Prior',
					lastName: 'Season',
					emailAddress: 'prior.season-e2e@test.com',
					firstRiskOn: '2025-12-20T15:00:00.000Z',
					latestRiskOn: '2025-12-20T16:00:00.000Z',
					programYear: 2025,
					lateDuplicateAttemptCount: 1,
					totalRiskAttemptCount: 1,
				},
			],
			attempts: [
				{
					customerId: 'scan-mixed-e2e',
					scannedOn: '2026-12-20T16:00:00.000Z',
					priorEventOn: '2026-12-15T16:00:00.000Z',
					outcome: 'duplicate-risk',
					inputMethod: 'manual',
					codeSuffix: 'NEW1',
				},
				{
					customerId: 'scan-mixed-e2e',
					scannedOn: '2026-12-20T15:00:00.000Z',
					priorEventOn: '2026-12-18T16:00:00.000Z',
					outcome: 'cancelled',
					inputMethod: 'camera',
					codeSuffix: 'OLD1',
				},
				{
					customerId: 'scan-mixed-e2e',
					scannedOn: '2026-12-19T14:00:00.000Z',
					priorEventOn: '2026-12-15T16:00:00.000Z',
					outcome: 'duplicate-risk',
					inputMethod: 'manual',
					codeSuffix: 'NEW1',
				},
				{
					customerId: 'scan-mixed-e2e',
					scannedOn: '2026-12-18T16:00:00.000Z',
					priorEventOn: '2026-12-17T16:00:00.000Z',
					outcome: 'cancelled',
					inputMethod: 'camera',
					codeSuffix: 'OLD1',
				},
			],
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/stats/scan-risk');
		await expect(page.getByText('Mixed Attempts', { exact: true })).toBeVisible();
		await expect(page.getByText('4 risk attempt(s)', { exact: true })).toBeVisible();
		await expect(page.getByText('Late duplicate 2', { exact: true })).toBeVisible();
		await expect(page.getByText('Canceled code 2', { exact: true })).toBeVisible();
		await expect(page.getByText('Prior Season', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Load more', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Load more', exact: true }).click();
		await expect(page.getByText('Paged Customer 20', { exact: true })).toBeVisible();

		await page.getByText('Mixed Attempts', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/stats\/scan-risk\/scan-mixed-e2e$/);
		const timeline = page.locator('ion-list[aria-label="Customer scan timeline"] ion-item');
		await expect(timeline).toHaveCount(4);
		await expect(timeline.nth(0).getByRole('heading')).toHaveText('duplicate-risk');
		await expect(timeline.nth(0)).toContainText('manual');
		await expect(timeline.nth(0)).toContainText('Code ending in NEW1');
		await expect(timeline.nth(1).getByRole('heading')).toHaveText('cancelled');
		await expect(timeline.nth(1)).toContainText('camera');
		await expect(timeline.nth(1)).toContainText('Code ending in OLD1');
	});

	test('CHECKIN-006 checks in an edited registration after staff changes its appointment', async ({
		page,
		seedDateTimeSlots,
		seedRegistration,
	}) => {
		await seedDateTimeSlots([
			{ id: 'checkin-original-slot', programYear: 2026, dateTime: '2026-12-15T16:00:00.000Z', maxSlots: 8 },
			{ id: 'checkin-edited-slot', programYear: 2026, dateTime: '2026-12-16T16:00:00.000Z', maxSlots: 8 },
		]);
		await seedRegistration({ ...registration, uid: 'edited-checkin-e2e', code: 'E2EEDIT1' });
		await signInAdminViaUi(page, defaultAdminAccount());
		await scanManualCode(page, 'E2EEDIT1');
		await expect(page).toHaveURL(/\/admin\/checkin\/review$/);

		await page.getByRole('button', { name: 'Change Date/Time', exact: true }).click();
		const modal = page.locator('ion-modal');
		await expect(modal).toBeVisible();
		const editedDay = modal.locator('ion-accordion').last();
		await editedDay.locator('ion-item[slot="header"]').click();
		await editedDay.locator('ion-list[slot="content"] ion-item').first().click();
		const confirm = page.locator('ion-alert').last();
		await expect(confirm).toContainText('Confirm Changes');
		await confirm.getByRole('button', { name: 'Continue', exact: true }).click();
		await expect(modal).toHaveCount(0);

		await page.getByText('Yes, check in', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/confirmation$/);
		await expect(page.getByText('Give the shopper 1 coupons.')).toBeVisible();
	});

	test('CHECKIN-011 lets staff cancel a submitted registration from review and blocks its superseded code', async ({
		page,
		seedRegistration,
	}) => {
		await seedRegistration({ ...registration, uid: 'review-cancel-e2e', code: 'E2ECAN01' });
		await signInAdminViaUi(page, defaultAdminAccount());
		await scanManualCode(page, 'E2ECAN01');
		await expect(page).toHaveURL(/\/admin\/checkin\/review$/);
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		const confirm = page.locator('ion-alert').last();
		await expect(confirm).toContainText('Deleting this reservation cannot be undone');
		await confirm.getByRole('button', { name: 'Ok', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/landing$/, { timeout: 20000 });

		await scanManualCode(page, 'E2ECAN01');
		await expect(page.getByText('Canceled registration code', { exact: true })).toBeVisible();
		await expect(page.getByText('Do not issue tickets or coupons.')).toBeVisible();
	});

	test('ADMIN-PRE-001 creates a staff pre-registration with a selected slot', async ({ page, seedDateTimeSlots }) => {
		await seedDateTimeSlots([{ id: 'pre-register-slot', programYear: 2026, dateTime: '2026-12-16T16:00:00.000Z', maxSlots: 8 }]);
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/pre-registration');
		await fillIonicInput(page, 'ion-input[formControlName="firstName"]', 'Pre');
		await fillIonicInput(page, 'ion-input[formControlName="lastName"]', 'Registered');
		await fillIonicInput(page, 'ion-input[formControlName="emailAddress"]', 'pre.registered-e2e@test.com');
		await fillIonicInput(page, 'ion-input[formControlName="zipCode"]', '80202');
		await page.getByText('Pick Agency', { exact: true }).click();
		await page.locator('ion-modal').getByText('SNAP', { exact: true }).click();
		await page.locator('ion-select[formControlName="dateTimeSlot"]').click();
		await page.locator('ion-alert').getByRole('radio').first().click();
		await page.locator('ion-alert').getByRole('button', { name: 'OK', exact: true }).click();
		await page.locator('admin-manage-children ion-item[button]').click();
		const modal = page.locator('ion-modal');
		await expect(modal).toBeVisible({ timeout: 10000 });
		await fillIonicInput(modal.page(), 'ion-modal ion-input[formControlName="firstName"]', 'Kid');
		await fillIonicInput(modal.page(), 'ion-modal ion-input[formControlName="lastName"]', 'One');
		await fillIonicInput(modal.page(), 'ion-modal ion-input[formControlName="dateOfBirth"]', '2025-01-01');
		await modal.locator('ion-input[formControlName="dateOfBirth"]').evaluate((element) =>
			element.dispatchEvent(new CustomEvent('ionChange', {
				detail: { value: '2025-01-01' },
				bubbles: true,
			})),
		);
		await modal.getByRole('button', { name: /save/i }).click();
		await page.getByText('Yes, continue', { exact: true }).click();
		await expect(page.locator('ion-alert')).toContainText('Registration Complete', { timeout: 20000 });
	});

	test('ADMIN-REG-001 completes a staff-created walk-in registration and check-in', async ({ page }) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/registration');
		await fillIonicInput(page, 'ion-input[formControlName="firstName"]', 'Walk');
		await fillIonicInput(page, 'ion-input[formControlName="lastName"]', 'In');
		await fillIonicInput(page, 'ion-input[formControlName="emailAddress"]', 'walk.in-e2e@test.com');
		await fillIonicInput(page, 'ion-input[formControlName="zipCode"]', '80203');
		await page.getByText('Pick Agency', { exact: true }).click();
		await page.locator('ion-modal').getByText('SNAP', { exact: true }).click();
		await page.locator('admin-manage-children ion-item[button]').click();
		const modal = page.locator('ion-modal');
		await expect(modal).toBeVisible({ timeout: 10000 });
		await fillIonicInput(modal.page(), 'ion-modal ion-input[formControlName="firstName"]', 'Kid');
		await fillIonicInput(modal.page(), 'ion-modal ion-input[formControlName="lastName"]', 'Walk');
		await fillIonicInput(modal.page(), 'ion-modal ion-input[formControlName="dateOfBirth"]', '2025-01-01');
		await modal.locator('ion-input[formControlName="dateOfBirth"]').evaluate((element) =>
			element.dispatchEvent(new CustomEvent('ionChange', {
				detail: { value: '2025-01-01' },
				bubbles: true,
			})),
		);
		await modal.getByRole('button', { name: /save/i }).click();
		await page.getByText('Yes, continue', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/confirmation$/);
		await expect(page.getByText('Give the shopper 1 coupons.')).toBeVisible();
	});
});
