import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	fillAdminSignInForm,
} from '../../fixtures/admin-helpers';

test.describe('mobile staff preferences', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
	});

	test('MOBILE-001 retains sign-in and search values across language changes and restores appearance', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/');
		await fillAdminSignInForm(page, defaultAdminAccount());
		await expect
			.poll(
				async () =>
					(await page.locator('admin-header').boundingBox())
						?.height ?? 999,
			)
			.toBeLessThanOrEqual(60);
		await page
			.getByRole('button', { name: 'Language', exact: true })
			.click();
		await page
			.getByRole('button', { name: 'Español', exact: true })
			.click();
		await expect(page.locator('html')).toHaveAttribute('lang', 'es');
		await expect(
			page.locator('#adminSignInEmail input:not(.cloned-input)'),
		).toHaveValue(defaultAdminAccount().emailAddress);
		await expect(
			page.locator('#adminSignInPassword input:not(.cloned-input)'),
		).toHaveValue(defaultAdminAccount().password);
		await page
			.getByRole('combobox', { name: 'Apariencia', exact: true })
			.selectOption('dark');
		await page
			.locator('ion-popover')
			.getByRole('button', { name: 'Aceptar', exact: true })
			.click();
		await page.locator('#adminSignInButton').click();
		await expect(page).toHaveURL(/\/admin\/landing$/);
		await expect(page.locator('html')).toHaveAttribute(
			'data-admin-theme',
			'dark',
		);
		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('lang', 'es');
		await expect(page.locator('html')).toHaveAttribute(
			'data-admin-theme',
			'dark',
		);
		await page.locator('#searchNav').click();
		const search = page.locator('admin-search');
		const lastName = search.locator(
			'ion-input[formControlName="lastName"] input:not(.cloned-input)',
		);
		await lastName.fill('Muñoz');
		await search
			.locator(
				'ion-input[formControlName="zipCode"] input:not(.cloned-input)',
			)
			.fill('01234');
		await search
			.getByRole('button', { name: 'Idioma', exact: true })
			.click();
		await page
			.getByRole('button', { name: 'English', exact: true })
			.click();
		await page
			.locator('ion-popover')
			.getByRole('button', { name: 'OK', exact: true })
			.click();
		await expect(lastName).toHaveValue('Muñoz');
		await expect(
			search.locator(
				'ion-input[formControlName="zipCode"] input:not(.cloned-input)',
			),
		).toHaveValue('01234');
		await search
			.getByRole('button', { name: 'Email Address', exact: true })
			.click();
		await search
			.locator(
				'ion-input[formControlName="emailAddress"] input:not(.cloned-input)',
			)
			.fill('qa@example.test');
		await search
			.getByRole('button', { name: 'Name & Zip Code', exact: true })
			.click();
		await expect(lastName).toHaveValue('Muñoz');
		await search
			.getByRole('button', { name: 'Language', exact: true })
			.click();
		await page
			.getByRole('combobox', { name: 'Appearance', exact: true })
			.selectOption('system');
		await expect(page.locator('html')).toHaveAttribute(
			'data-admin-theme',
			'light',
		);
		await page.emulateMedia({ colorScheme: 'dark' });
		await expect(page.locator('html')).toHaveAttribute(
			'data-admin-theme',
			'dark',
		);
		await page
			.locator('ion-popover')
			.getByRole('button', { name: 'OK', exact: true })
			.click();
		await expect(page.locator('ion-footer')).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						document.documentElement.scrollWidth <=
						window.innerWidth,
				),
			)
			.toBe(true);
		await page.goto('/admin/checkin/scan');
		await expect(page.locator('#manualCheckInCodeButton')).toBeVisible();
		await expect(page.locator('zxing-scanner')).toHaveCount(0);
		await expect(page.locator('ion-footer')).toBeVisible();
		await page
			.locator('ion-footer')
			.getByText('Search', { exact: true })
			.click();
		await expect(page).toHaveURL(/\/admin\/search$/);
		await page.goto('/admin/pre-registration');
		await expect
			.poll(() =>
				page
					.locator('ion-item:has(> ion-input)')
					.first()
					.evaluate((e) =>
						getComputedStyle(e)
							.getPropertyValue('--inner-border-width')
							.trim(),
					),
			)
			.toBe('0');
		await page.goto('/admin/stats/registration');
		await expect(page.locator('ion-footer')).toBeVisible();
		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(page.locator('ion-footer')).toBeVisible();
		await page.locator('#checkInTab').click();
		await expect(page).toHaveURL(/\/admin\/checkin\/scan$/);
		await expect(page.locator('zxing-scanner')).toHaveCount(0);
	});
});
