import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('staff customer lookup', () => {
	test.beforeEach(
		async ({
			clearData,
			seedPublicParams,
			seedAdminUser,
			seedRegistrationSearchIndex,
		}) => {
			await clearData();
			await seedPublicParams({});
			await seedAdminUser(defaultAdminAccount());
			await seedRegistrationSearchIndex([
				{
					id: 'lookup-customer-1',
					firstName: 'Clara',
					lastName: 'Claus',
					emailAddress: 'clara.claus@example.com',
					customerId: 'lookup-customer-1',
					zip: '80202',
					code: 'ABC1234',
				},
			]);
		},
	);

	test('ZIP-001 preserves a leading zero through the search form', async ({ page, seedRegistrationSearchIndex }) => {
		await seedRegistrationSearchIndex([{ id: 'zero-zip', customerId: 'zero-zip', firstName: 'Zero', lastName: 'Claus', zip: '01234', emailAddress: 'zero@example.test', code: 'ZERO001' }]);
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/search/by-name');
		await page.locator('ion-input[formControlName="lastName"] input').fill('Claus');
		await page.locator('ion-input[formControlName="zipCode"] input').fill('01234');
		await page.getByRole('link', { name: 'Search', exact: true }).click();
		await expect(page.locator('.result-item')).toHaveCount(1);
		await expect(page.locator('.result-item')).toContainText('Zero Claus');
		await expect(page.locator('.result-item')).toContainText('01234');
	});
	test('REFRESH-005 reloads the active search without re-entering its criteria', async ({
		page,
		seedRegistrationSearchIndex,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());
		await page.goto('/admin/search/by-name');
		await page
			.locator('ion-input[formControlName="lastName"] input')
			.fill('Claus');
		await page
			.locator('ion-input[formControlName="zipCode"] input')
			.fill('80202');
		await page.getByRole('link', { name: 'Search', exact: true }).click();
		await expect(page.locator('.result-item')).toHaveCount(1);
		await seedRegistrationSearchIndex([
			{
				id: 'refresh-search',
				customerId: 'refresh-search',
				firstName: 'Fresh',
				lastName: 'Claus',
				zip: '80202',
				emailAddress: 'fresh@example.com',
				code: 'FRESH001',
			},
		]);
		await expect(page.locator('.result-item')).toHaveCount(1);
		await page
			.getByRole('button', { name: 'Refresh results', exact: true })
			.click();
		await expect(page.locator('.result-item')).toHaveCount(2);
		await expect(
			page.getByText('Fresh Claus', { exact: true }),
		).toBeVisible();
	});

	test('CHECKIN-001 through CHECKIN-003 find a registration by each lookup key', async ({
		page,
	}) => {
		await signInAdminViaUi(page, defaultAdminAccount());

		const searches = [
			{
				route: 'by-name',
				fields: [
					['lastName', 'Claus'],
					['zipCode', '80202'],
				],
			},
			{
				route: 'by-email',
				fields: [['emailAddress', 'clara.claus@example.com']],
			},
			{
				route: 'by-code',
				fields: [['code', 'abc1234']],
			},
		] as const;

		for (const search of searches) {
			await page.goto(`/admin/search/${search.route}`);
			for (const [field, value] of search.fields) {
				await page
					.locator(`ion-input[formControlName="${field}"] input`)
					.fill(value);
			}

			await page
				.getByRole('link', { name: 'Search', exact: true })
				.click();
			await expect(page).toHaveURL(/\/admin\/search\/results$/);
			await expect(page.locator('.result-item')).toContainText(
				'Clara Claus',
			);
			await expect(page.locator('.result-item')).toContainText(
				'clara.claus@example.com',
			);
			await expect(page.locator('.result-item')).toContainText('80202');
		}
	});
});
