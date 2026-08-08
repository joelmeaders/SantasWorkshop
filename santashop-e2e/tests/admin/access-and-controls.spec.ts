import { test, expect } from '../../fixtures/test-fixtures';
import type { APIRequestContext, Locator } from '@playwright/test';
import {
	defaultAdminAccount,
	defaultOwnerAccount,
	fillAdminSignInForm,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test.describe('staff identity, authorization, and runtime controls', () => {
	test.beforeEach(async ({ clearData }) => {
		await clearData();
	});

	test('STAFF-001 redirects unauthenticated operational access to sign-in', async ({
		page,
		seedPublicParams,
	}) => {
		await page.goto('/');
		const signOut = page.locator('#adminSignOutButton');
		await signOut.click({ timeout: 3000 }).then(
			async () => page.waitForURL('**/', { timeout: 30000 }),
			() => undefined,
		);
		await seedPublicParams({});
		await page.goto('/admin/landing');
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('#adminSignInButton')).toBeVisible({
			timeout: 15000,
		});
	});

	test('STAFF-002 allows an authorized admin into the operational workspace', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);

		await expect(page.locator('#searchNav')).toBeVisible();
		await expect(page.locator('#scheduleEditorNav')).toBeVisible();
	});

	test('STAFF-003 denies the operational workspace to a non-privileged account', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount({
			uid: 'non-admin-e2e-user',
			emailAddress: 'non-admin-e2e@test.com',
			admin: false,
		});
		await seedPublicParams({});
		await seedAdminUser(account);
		await page.goto('/');
		await fillAdminSignInForm(page, account);
		await page.click('#adminSignInButton');

		await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
		await expect(page.locator('#adminSignInButton')).toBeVisible({
			timeout: 15000,
		});
		await expect(page.locator('#scheduleEditorNav')).toHaveCount(0);
	});

	test('STAFF-006 limits a check-in operator to operational work', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount({
			uid: 'checkin-operator-e2e-user',
			emailAddress: 'checkin-operator-e2e@test.com',
			admin: false,
			roles: ['checkin'],
		});
		await seedPublicParams({});
		await seedAdminUser(account);
		await page.goto('/');
		await fillAdminSignInForm(page, account);
		await page.click('#adminSignInButton');

		await expect(page).toHaveURL(/\/admin\/landing$/, { timeout: 30000 });
		await expect(page.locator('#checkInNav')).toBeVisible();
		await expect(page.locator('#onSiteRegistrationNav')).toBeVisible();
		await expect(page.locator('#preRegistrationNav')).toBeVisible();
		await expect(page.locator('#scheduleEditorNav')).toHaveCount(0);
		await expect(page.getByText('User Management', { exact: true })).toHaveCount(
			0,
		);

		await page.goto('/admin/schedule-editor');
		await expect(page).toHaveURL(/\/admin\/landing$/, { timeout: 30000 });
		await page.goto('/admin/stats/registration');
		await expect(page).toHaveURL(/\/admin\/landing$/, { timeout: 30000 });
	});

	test('STAFF-004 signs out and blocks protected operational routes', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);
		await page.click('#adminSignOutButton');
		await expect(page).toHaveURL(/\/$/, { timeout: 30000 });

		await page.goto('/admin/landing');
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('#adminSignInButton')).toBeVisible();
	});

	test('STAFF-005 applies runtime feature controls to staff navigation', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({
			admin: {
				checkinEnabled: false,
				onsiteRegistrationEnabled: false,
				preRegistrationEnabled: false,
				allowCancelRegistration: false,
				allowChangeRegistration: false,
			},
		});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);

		await expectIonicDisabled(page.locator('#checkInNav'));
		await expectIonicDisabled(page.locator('#onSiteRegistrationNav'));
		await expectIonicDisabled(page.locator('#preRegistrationNav'));
		await expectIonicDisabled(page.locator('#checkInTab'));
		await expectIonicDisabled(page.locator('#onSiteRegistrationTab'));
		await expect(page.locator('#searchNav')).toBeVisible();
	});

	test('OWNER-001 denies owner operations to an ordinary administrator', async ({
		page,
		seedPublicParams,
		seedAdminUser,
	}) => {
		const account = defaultAdminAccount();
		await seedPublicParams({});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);

		await page.goto('/admin/owner-operations');

		await expect(page).toHaveURL(/\/admin\/landing$/, {
			timeout: 30000,
		});
		await expect(page.locator('#ownerOperationsNav')).toHaveCount(0);
	});

	test('RULES-001 denies direct access to owner operation records', async ({
		request,
		seedAdminUser,
	}) => {
		const account = defaultOwnerAccount();
		await seedAdminUser(account);
		const signInResponse = await request.post(
			'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
			{
				data: {
					email: account.emailAddress,
					password: account.password,
					returnSecureToken: true,
				},
			},
		);
		expect(signInResponse.ok()).toBe(true);
		const { idToken } = (await signInResponse.json()) as {
			idToken: string;
		};

		for (const collection of [
			'ownerOperationPreviews',
			'ownerOperations',
			'ownerOperationLocks',
		]) {
			const response = await request.get(
				`http://127.0.0.1:8180/v1/projects/demo-santashop/databases/(default)/documents/${collection}/rules-test`,
				{ headers: { Authorization: `Bearer ${idToken}` } },
			);
			expect(response.status()).toBe(403);
		}
	});

	test('RULES-002 allows administrators to read scan audit records, but never lets clients write them', async ({
		page,
		request,
		seedPublicParams,
		seedAdminUser,
		seedRegistration,
	}) => {
		const admin = defaultAdminAccount({
			uid: 'scan-rules-admin-e2e',
			emailAddress: 'scan-rules-admin-e2e@test.com',
		});
		const checkinOnly = defaultAdminAccount({
			uid: 'scan-rules-checkin-e2e',
			emailAddress: 'scan-rules-checkin-e2e@test.com',
			admin: false,
			roles: ['checkin'],
		});
		await seedPublicParams({});
		await seedAdminUser(admin);
		await seedAdminUser(checkinOnly);
		await seedRegistration({
			uid: 'scan-rules-registration-e2e',
			firstName: 'Rule',
			lastName: 'Evidence',
			emailAddress: 'scan-rules-registration-e2e@test.com',
			zipCode: '80202',
			code: 'RULESCAN',
			dateTime: '2026-12-15T16:00:00.000Z',
			hasCheckedIn: true,
			checkInDateTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
		});

		await signInAdminViaUi(page, admin);
		await page.goto('/admin/checkin/scan');
		await page.locator('#manualCheckInCodeButton').click();
		const manualAlert = page.locator('ion-alert');
		await manualAlert.locator('input').fill('RULESCAN');
		await manualAlert.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(page.getByText('Suspicious duplicate scan')).toBeVisible();

		const [adminToken, checkinToken] = await Promise.all([
			getFirestoreIdToken(request, admin),
			getFirestoreIdToken(request, checkinOnly),
		]);
		for (const collection of [
			'registrationScanAttempts',
			'registrationScanRiskSummaries',
		]) {
			const adminRead = await request.get(firestoreCollectionUrl(collection), {
				headers: { Authorization: `Bearer ${adminToken}` },
			});
			expect(adminRead.status()).toBe(200);
			const documents = ((await adminRead.json()) as {
				documents?: { name: string }[];
			}).documents;
			expect(documents?.length).toBeGreaterThan(0);
			const documentId = documents?.[0]?.name.split('/').at(-1);
			expect(documentId).toBeTruthy();

			const checkinRead = await request.get(firestoreCollectionUrl(collection), {
				headers: { Authorization: `Bearer ${checkinToken}` },
			});
			expect(checkinRead.status()).toBe(403);

			const headers = { Authorization: `Bearer ${adminToken}` };
			const create = await request.post(firestoreCollectionUrl(collection), {
				headers,
				data: { fields: { proof: { stringValue: 'client-write' } } },
			});
			expect(create.status()).toBe(403);

			const documentUrl = firestoreDocumentUrl(collection, documentId as string);
			const update = await request.patch(documentUrl, {
				headers,
				data: { fields: { proof: { stringValue: 'client-update' } } },
			});
			expect(update.status()).toBe(403);
			const remove = await request.delete(documentUrl, { headers });
			expect(remove.status()).toBe(403);
		}
	});
});

const expectIonicDisabled = async (locator: Locator): Promise<void> => {
	await expect(locator).toBeVisible({ timeout: 10000 });
	await expect
		.poll(() =>
			locator.evaluate((element) => Reflect.get(element, 'disabled')),
		)
		.toBe(true);
};

const firestoreCollectionUrl = (collection: string): string =>
	`http://127.0.0.1:8180/v1/projects/demo-santashop/databases/(default)/documents/${collection}`;

const firestoreDocumentUrl = (collection: string, documentId: string): string =>
	`${firestoreCollectionUrl(collection)}/${documentId}`;

const getFirestoreIdToken = async (
	request: APIRequestContext,
	account: ReturnType<typeof defaultAdminAccount>,
): Promise<string> => {
	const response = await request.post(
		'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
		{
			data: {
				email: account.emailAddress,
				password: account.password,
				returnSecureToken: true,
			},
		},
	);
	expect(response.ok()).toBe(true);
	return ((await response.json()) as { idToken: string }).idToken;
};
