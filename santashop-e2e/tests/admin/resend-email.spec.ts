import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	fillIonicInput,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

const completeRegistration = {
	uid: 'resend-email-registration-e2e',
	firstName: 'Resend',
	lastName: 'Email',
	emailAddress: 'resend.email-e2e@test.com',
	zipCode: '80202',
	code: 'E2ERES01',
	dateTime: '2026-12-15T16:00:00.000Z',
};

test.describe('admin resend-email tool', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('ADMIN-RESEND-001 queues a registration email for a completed registration', async ({
		page,
		seedRegistration,
	}) => {
		await seedRegistration(completeRegistration);
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/resend-email');
		await fillIonicInput(
			page,
			'ion-input[formControlName="emailAddress"]',
			completeRegistration.emailAddress,
		);
		await page.getByRole('button', { name: /send email/i }).click();

		const alert = page.locator('ion-alert');
		await expect(alert).toContainText('Email sent!', { timeout: 15000 });
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(
			page.locator('ion-input[formControlName="emailAddress"] input'),
		).toHaveValue('');
	});

	test('ADMIN-RESEND-001 explains when the registration QR code is not ready', async ({
		page,
		seedRegistration,
	}) => {
		await seedRegistration({
			...completeRegistration,
			uid: 'resend-email-not-ready-e2e',
			qrReady: false,
		});
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/resend-email');
		await fillIonicInput(
			page,
			'ion-input[formControlName="emailAddress"]',
			completeRegistration.emailAddress,
		);
		await page.getByRole('button', { name: /send email/i }).click();

		const alert = page.locator('ion-alert');
		await expect(alert).toContainText('QR code is not ready', {
			timeout: 15000,
		});
		await alert.getByRole('button', { name: 'OK', exact: true }).click();
	});
});
