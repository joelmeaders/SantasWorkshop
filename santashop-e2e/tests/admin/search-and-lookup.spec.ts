import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('staff customer lookup', () => {
	test.beforeEach(
		async ({ clearData, seedPublicParams, seedAdminUser, seedRegistrationSearchIndex }) => {
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

			await page.getByRole('link', { name: 'Search', exact: true }).click();
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
