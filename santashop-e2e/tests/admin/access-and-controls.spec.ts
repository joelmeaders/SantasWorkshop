import { test, expect } from '../../fixtures/test-fixtures';
import type { APIRequestContext, Locator } from '@playwright/test';
import {
	defaultAdminAccount,
	defaultOwnerAccount,
	fillAdminSignInForm,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import {
	E2E_AUTH_EMULATOR_URL,
	E2E_FIRESTORE_EMULATOR_URL,
	E2E_PROGRAM_YEAR,
	E2E_PROJECT_ID,
	E2E_STORAGE_BUCKET,
	E2E_STORAGE_EMULATOR_URL,
	e2eDateTime,
} from '../../fixtures/season';

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
			roles: [],
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

	test('STAFF-008 allows check-in staff to search by name and open registration review', async ({
		page,
		seedPublicParams,
		seedAdminUser,
		seedRegistration,
	}) => {
		const account = defaultAdminAccount({
			uid: 'checkin-lookup-e2e-user',
			emailAddress: 'checkin-lookup-e2e@test.com',
			roles: ['checkin'],
		});
		await seedPublicParams({});
		await seedAdminUser(account);
		await seedRegistration({
			uid: 'checkin-lookup-registration-e2e',
			firstName: 'Lookup',
			lastName: 'Operator',
			emailAddress: 'checkin-lookup-registration-e2e@test.com',
			zipCode: '80202',
			code: 'LOOKUP01',
			dateTime: e2eDateTime(12, 15, 16),
		});

		await page.goto('/');
		await fillAdminSignInForm(page, account);
		await page.click('#adminSignInButton');
		await page.waitForURL('**/admin/landing', { timeout: 30000 });
		await page.goto('/admin/search/by-name');
		await page.locator('ion-input[formControlName="lastName"] input').fill('Operator');
		await page.locator('ion-input[formControlName="zipCode"] input').fill('80202');
		await page.getByRole('link', { name: 'Search', exact: true }).click();
		await expect(page.locator('.result-item')).toHaveCount(1);
		await expect(page.locator('.result-item')).toContainText(/lookup Operator/i);
		await page.locator('.result-item').click();
		await expect(page).toHaveURL(/\/admin\/checkin\/review/);
		await expect(page.getByText('Lookup Operator', { exact: true })).toBeVisible();
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
		await expectIonicDisabled(page.locator('ion-tab-button[href="/admin/checkin"]'));
		await expectIonicDisabled(page.locator('ion-tab-button[href="/admin/registration"]'));
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
			`${E2E_AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
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
			`${E2E_FIRESTORE_EMULATOR_URL}/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents/${collection}/rules-test`,
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
			dateTime: e2eDateTime(12, 15, 16),
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

	test('RULES-003 keeps authoritative records and QR objects server-only', async ({
		request,
		seedAdminUser,
		seedDateTimeSlots,
		seedRegistration,
		inspectRegistrationQrLifecycle,
	}) => {
		const admin = defaultAdminAccount({
			uid: 'authoritative-rules-admin-e2e',
			emailAddress: 'authoritative-rules-admin-e2e@test.com',
		});
		await seedAdminUser(admin);
		await seedDateTimeSlots([
			{
				id: 'rules-slot',
				programYear: E2E_PROGRAM_YEAR,
				dateTime: e2eDateTime(12, 15, 16),
				maxSlots: 350,
				slotsReserved: 10,
				enabled: true,
			},
		]);
		await seedRegistration({
			uid: 'rules-qr-customer',
			firstName: 'Private',
			lastName: 'Code',
			emailAddress: 'private-code-e2e@test.com',
			zipCode: '80202',
			code: 'PRIVATE1',
			dateTime: e2eDateTime(12, 15, 16),
			qrReady: true,
		});

		const adminToken = await getFirestoreIdToken(request, admin);
		const headers = { Authorization: `Bearer ${adminToken}` };
		for (const collection of [
			'users',
			'registrationsearchindex',
			'emailTemplates',
		]) {
			const create = await request.post(firestoreCollectionUrl(collection), {
				headers,
				data: { fields: { proof: { stringValue: 'client-write' } } },
			});
			expect(create.status()).toBe(403);
		}

		const counterTamper = await request.patch(
			firestoreDocumentUrl('dateTimeSlots', 'rules-slot'),
			{
				headers,
				data: {
					fields: {
						programYear: { integerValue: E2E_PROGRAM_YEAR.toString() },
						dateTime: { timestampValue: e2eDateTime(12, 15, 16) },
						maxSlots: { integerValue: '350' },
						slotsReserved: { integerValue: '0' },
						enabled: { booleanValue: true },
						lastUpdated: { timestampValue: new Date().toISOString() },
					},
				},
			},
		);
		expect(counterTamper.status()).toBe(403);

		const qrLifecycle = await inspectRegistrationQrLifecycle(
			'private-code-e2e@test.com',
		);
		expect(qrLifecycle.current.path).toBeTruthy();
		const anonymousQrRead = await request.get(
			`${E2E_STORAGE_EMULATOR_URL}/v0/b/${E2E_STORAGE_BUCKET}/o/${encodeURIComponent(qrLifecycle.current.path as string)}?alt=media`,
		);
		expect([401, 403]).toContain(anonymousQrRead.status());
	});

	test('RULES-004 permits check-in lookup reads without granting customer or audit access', async ({
		request,
		seedAdminUser,
		seedRegistration,
	}) => {
		const checkinOnly = defaultAdminAccount({
			uid: 'lookup-rules-checkin-e2e',
			emailAddress: 'lookup-rules-checkin-e2e@test.com',
			roles: ['checkin'],
		});
		const unrelatedCustomer = defaultAdminAccount({
			uid: 'lookup-rules-customer-e2e',
			emailAddress: 'lookup-rules-customer-e2e@test.com',
			roles: [],
		});
		await seedAdminUser(checkinOnly);
		await seedAdminUser(unrelatedCustomer);
		await seedRegistration({
			uid: 'lookup-rules-registration-e2e',
			firstName: 'Lookup',
			lastName: 'Allowed',
			emailAddress: 'lookup-rules-registration-e2e@test.com',
			zipCode: '80202',
			code: 'RULELOOKUP',
			dateTime: e2eDateTime(12, 15, 16),
		});

		const checkinToken = await getFirestoreIdToken(request, checkinOnly);
		const customerToken = await getFirestoreIdToken(request, unrelatedCustomer);
		const checkinHeaders = { Authorization: `Bearer ${checkinToken}` };
		const customerHeaders = { Authorization: `Bearer ${customerToken}` };

		for (const collection of ['registrationsearchindex', 'registrations']) {
			const checkinRead = await request.get(firestoreCollectionUrl(collection), {
				headers: checkinHeaders,
			});
			expect(checkinRead.status()).toBe(200);
			expect(
				((await checkinRead.json()) as { documents?: unknown[] }).documents,
			).toBeTruthy();

			const customerRead = await request.get(
				firestoreDocumentUrl(collection, 'lookup-rules-registration-e2e'),
				{ headers: customerHeaders },
			);
			expect(customerRead.status()).toBe(403);

			const anonymousRead = await request.get(
				firestoreDocumentUrl(collection, 'lookup-rules-registration-e2e'),
			);
			expect([401, 403]).toContain(anonymousRead.status());

			const create = await request.post(firestoreCollectionUrl(collection), {
				headers: checkinHeaders,
				data: { fields: { proof: { stringValue: 'checkin-write' } } },
			});
			expect(create.status()).toBe(403);

			const update = await request.patch(
				firestoreDocumentUrl(collection, 'lookup-rules-registration-e2e'),
				{
					headers: checkinHeaders,
					data: { fields: { proof: { stringValue: 'checkin-update' } } },
				},
			);
			expect(update.status()).toBe(403);

			const remove = await request.delete(
				firestoreDocumentUrl(collection, 'lookup-rules-registration-e2e'),
				{ headers: checkinHeaders },
			);
			expect(remove.status()).toBe(403);
		}

		const mutationReceiptRead = await request.get(
			firestoreDocumentUrl(
				'registrations/lookup-rules-registration-e2e/mutationReceipts',
				'rules-test',
			),
			{ headers: checkinHeaders },
		);
		expect(mutationReceiptRead.status()).toBe(403);

		for (const collection of [
			'users',
			'checkins',
			'registrationScanAttempts',
			'registrationScanRiskSummaries',
		]) {
			const checkinRead = await request.get(
				firestoreDocumentUrl(collection, 'lookup-rules-registration-e2e'),
				{ headers: checkinHeaders },
			);
			expect(checkinRead.status()).toBe(403);
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
	`${E2E_FIRESTORE_EMULATOR_URL}/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents/${collection}`;

const firestoreDocumentUrl = (collection: string, documentId: string): string =>
	`${firestoreCollectionUrl(collection)}/${documentId}`;

const getFirestoreIdToken = async (
	request: APIRequestContext,
	account: ReturnType<typeof defaultAdminAccount>,
): Promise<string> => {
	const response = await request.post(
		`${E2E_AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
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
