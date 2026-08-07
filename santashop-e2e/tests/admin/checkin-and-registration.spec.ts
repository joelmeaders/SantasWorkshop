import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	fillIonicInput,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

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

	test('CHECKIN-004 scans a valid code through the manual scanner fallback and creates a check-in', async ({ page, seedRegistration }) => {
		await seedRegistration(registration);
		await signInAdminViaUi(page, defaultAdminAccount());
		const pageErrors: string[] = [];
		page.on('pageerror', (error) => pageErrors.push(error.message));
		await page.goto('/admin/checkin/scan');
		await expect(page).toHaveURL(/\/admin\/checkin\/scan$/);
		if (pageErrors.length) throw new Error(pageErrors.join('\n'));
		await page.locator('#manualCheckInCodeButton').click();
		const alert = page.locator('ion-alert');
		await expect(alert).toBeVisible();
		await alert.locator('input').fill(registration.code);
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/review$/);
		await expect(page.getByText('Casey Checkin', { exact: true })).toBeVisible();
		await page.getByText('Yes, check in', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/confirmation$/);
		await expect(page.getByText('Give the shopper 1 coupons.')).toBeVisible();
	});

	test('CHECKIN-005 presents a scanned registration for staff review before confirmation', async ({ page, seedRegistration }) => {
		await seedRegistration(registration);
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/checkin/scan');
		await page.locator('#manualCheckInCodeButton').click();
		const alert = page.locator('ion-alert');
		await alert.locator('input').fill(registration.code);
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/review$/);
		await expect(page.getByText('Review all registration information.')).toBeVisible();
		await expect(page.getByText('Test Child', { exact: true })).toBeVisible();
		await expect(page.getByText('Yes, check in', { exact: true })).toBeVisible();
	});

	test('CHECKIN-006 routes an already checked-in registration to the duplicate safeguard', async ({ page, seedRegistration }) => {
		await seedRegistration({ ...registration, uid: 'duplicate-checkin-e2e', code: 'E2EDUP01', hasCheckedIn: true });
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/checkin/scan');
		await page.locator('#manualCheckInCodeButton').click();
		const alert = page.locator('ion-alert');
		await alert.locator('input').fill('E2EDUP01');
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/review$/);
		await page.getByText('Yes, check in', { exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/checkin\/duplicate\/duplicate-checkin-e2e$/);
		await expect(page.getByText('THIS CUSTOMER ALREADY GOT TOYS!')).toBeVisible();
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
