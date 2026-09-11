import { devices, type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import { E2E_PROGRAM_YEAR, e2eDateTime } from '../../fixtures/season';

const registration = {
	uid: 'concurrent-family',
	firstName: 'Concurrent',
	lastName: 'Family',
	emailAddress: 'concurrent-family@test.com',
	zipCode: '80202',
	code: 'RACE0001',
	dateTime: e2eDateTime(12, 12, 17),
};
const secondStaff = defaultAdminAccount({
	uid: 'second-operator',
	emailAddress: 'second-operator@test.com',
});

async function review(page: Page, code: string): Promise<void> {
	await page.goto(`/admin/checkin/review;qrcode=${code}`);
	await expect(
		page.getByText('Yes, check in', { exact: true }),
	).toBeVisible();
}

test.describe('competing staff and uncertain writes', () => {
	test.beforeEach(async ({ clearData, seedPublicParams, seedAdminUser }) => {
		await clearData();
		await seedPublicParams({});
		await seedAdminUser(defaultAdminAccount());
		await seedAdminUser(secondStaff);
		await seedAdminUser(
			defaultAdminAccount({
				uid: registration.uid,
				emailAddress: registration.emailAddress,

				roles: [],
			}),
		);
	});

	test('CONCURRENT-001 only one operator can check in the same registration', async ({
		page,
		browser,
		baseURL,
		seedRegistration,
		inspectRegistrationScanAudit,
		inspectRegistrationBoundary,
	}) => {
		await seedRegistration(registration);
		const before = await inspectRegistrationBoundary(
			registration.emailAddress,
		);
		expect(before.annualCheckin).toEqual({
			customerCount: 0,
			childCount: 0,
		});
		const peer = await browser.newContext({
			...devices['Pixel 5'],
			baseURL,
			timezoneId: 'America/Denver',
		});
		try {
			const other = await peer.newPage();
			await signInAdminViaUi(page, defaultAdminAccount());
			await signInAdminViaUi(other, secondStaff);
			await Promise.all([
				review(page, registration.code),
				review(other, registration.code),
			]);
			// Hold both real requests until both operators have submitted the same stale review.
			let arrivals = 0;
			let release!: () => void;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			for (const operator of [page, other]) {
				await operator.route(
					'**/us-central1/checkIn',
					async (route) => {
						if (++arrivals === 2) release();
						await gate;
						await route.continue();
					},
				);
			}
			await Promise.all(
				[page, other].map((operator) =>
					operator
						.getByText('Yes, check in', { exact: true })
						.click(),
				),
			);
			await expect
				.poll(
					() =>
						[page.url(), other.url()].filter((url) =>
							url.endsWith('/confirmation'),
						).length,
					{ timeout: 15000 },
				)
				.toBe(1);
			await expect
				.poll(
					() =>
						[page.url(), other.url()].filter((url) =>
							url.includes('/duplicate/'),
						).length,
					{ timeout: 15000 },
				)
				.toBe(1);
			const blocked = page.url().includes('/duplicate/') ? page : other;
			await expect(
				blocked.getByText('Do not issue tickets or coupons.'),
			).toBeVisible();
			const audit = await inspectRegistrationScanAudit(
				registration.emailAddress,
			);
			expect(audit.attempts).toHaveLength(1);
			expect(audit.attempts[0].outcome).toBe('duplicate-accidental');
			expect(audit.rawCodePersisted).toBe(false);
			const stored = await inspectRegistrationBoundary(
				registration.emailAddress,
			);
			expect(stored).toMatchObject({
				checkinCount: 1,
				checkinIds: [registration.uid],
				checkinChildCount: 1,
				registration: { hasCheckedIn: true },
				annualCheckin: { customerCount: 1, childCount: 1 },
			});
			// A fresh lookup must also see the stored check-in, not just the two page states.
			await blocked.goto('/admin/checkin/scan');
			await blocked.locator('#manualCheckInCodeButton').click();
			await blocked.locator('ion-alert input').fill(registration.code);
			await blocked
				.locator('ion-alert')
				.getByRole('button', { name: 'OK', exact: true })
				.click();
			await expect(blocked).toHaveURL(/\/duplicate\/concurrent-family$/);
			expect(
				await inspectRegistrationBoundary(registration.emailAddress),
			).toEqual(stored);
		} finally {
			await peer.close();
		}
	});

	test('RECOVERY-WRITE a lost successful check-in response cannot issue a second confirmation', async ({
		page,
		seedRegistration,
		inspectRegistrationScanAudit,
		inspectRegistrationBoundary,
	}) => {
		await seedRegistration(registration);
		await signInAdminViaUi(page, defaultAdminAccount());
		await review(page, registration.code);
		let committed = false;
		await page.route(
			'**/us-central1/checkIn',
			async (route) => {
				const response = await route.fetch();
				expect(response.ok()).toBe(true);
				expect(
					await inspectRegistrationBoundary(
						registration.emailAddress,
					),
				).toMatchObject({
					checkinCount: 1,
					checkinChildCount: 1,
					registration: { hasCheckedIn: true },
					annualCheckin: { customerCount: 1, childCount: 1 },
				});
				committed = true;
				await route.abort('connectionreset');
			},
			{ times: 1 },
		);
		await page.getByText('Yes, check in', { exact: true }).click();
		await expect(page.locator('ion-alert')).toContainText(
			'Error checking in',
		);
		expect(committed).toBe(true);
		await expect(page).not.toHaveURL(/\/confirmation$/);
		// Recover through a fresh review and retry; the first write really reached Firestore.
		await page.goto(`/admin/checkin/review;qrcode=${registration.code}`);
		await page.getByText('Yes, check in', { exact: true }).click();
		await expect(page).toHaveURL(/\/duplicate\/concurrent-family$/);
		await expect(
			page.getByText('Do not issue tickets or coupons.'),
		).toBeVisible();
		const audit = await inspectRegistrationScanAudit(
			registration.emailAddress,
		);
		expect(audit.attempts).toHaveLength(1);
		expect(audit.attempts[0].outcome).toBe('duplicate-accidental');
		expect(
			await inspectRegistrationBoundary(registration.emailAddress),
		).toMatchObject({
			checkinCount: 1,
			checkinChildCount: 1,
			registration: { hasCheckedIn: true },
			annualCheckin: { customerCount: 1, childCount: 1 },
		});
	});

	for (const change of ['cancelled', 'unsubmitted', 'children'] as const) {
		test(`STALE-REVIEW uses authoritative ${change} state at check-in`, async ({
			page,
			seedRegistration,
			inspectRegistrationBoundary,
		}) => {
			await seedRegistration(registration);
			await signInAdminViaUi(page, defaultAdminAccount());
			await review(page, registration.code);
			let arrived = false;
			let release!: () => void;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			await page.route(
				'**/us-central1/checkIn',
				async (route) => {
					expect(
						route.request().postDataJSON().data.registration
							.children,
					).toHaveLength(1);
					arrived = true;
					await gate;
					await route.continue();
				},
				{ times: 1 },
			);
			await page.getByText('Yes, check in', { exact: true }).click();
			await expect.poll(() => arrived).toBe(true);
			try {
				await seedRegistration({
					...registration,
					...(change === 'unsubmitted' ? { incomplete: true } : {}),
					...(change === 'cancelled'
						? {
								cancellation: {
									supersededCode: registration.code,
								},
							}
						: {}),
					...(change === 'children'
						? {
								children: [
									{
										firstName: 'Changed',
										lastName: 'Child',
										dateOfBirth: '2018-01-01',
										ageGroup: '6-8',
										toyType: 'girls',
									},
									{
										firstName: 'New',
										lastName: 'Child',
										dateOfBirth: '2019-01-01',
										ageGroup: '6-8',
										toyType: 'boys',
									},
								],
							}
						: {}),
				});
			} finally {
				release();
			}
			if (change === 'children') {
				await expect(page).toHaveURL(/\/confirmation$/);
				await expect(
					page.getByText('Give the shopper 2 coupons.'),
				).toBeVisible();
				expect(
					await inspectRegistrationBoundary(
						registration.emailAddress,
					),
				).toMatchObject({
					checkinCount: 1,
					checkinChildCount: 2,
					registration: { hasCheckedIn: true },
					annualCheckin: { customerCount: 1, childCount: 2 },
				});
			} else {
				await expect(page.locator('ion-alert')).toContainText(
					'Error checking in',
				);
				await expect(page).not.toHaveURL(/\/confirmation$/);
				expect(
					await inspectRegistrationBoundary(
						registration.emailAddress,
					),
				).toMatchObject({
					checkinCount: 0,
					checkinChildCount: 0,
					registration: { hasCheckedIn: false },
					annualCheckin: { customerCount: 0, childCount: 0 },
				});
			}
		});
	}

	test('CONCURRENT-002 concurrent appointment changes persist with eventually consistent capacity', async ({
		page,
		browser,
		baseURL,
		seedRegistration,
		seedAdminUser,
		seedDateTimeSlots,
		inspectRegistrationQrLifecycle,
	}) => {
		const otherFamily = {
			...registration,
			uid: 'other-family',
			emailAddress: 'other-family@test.com',
			code: 'RACE0002',
		};
		await seedAdminUser(
			defaultAdminAccount({
				uid: otherFamily.uid,
				emailAddress: otherFamily.emailAddress,

				roles: [],
			}),
		);
		await seedRegistration(registration);
		await seedRegistration(otherFamily);
		await seedDateTimeSlots([
			{
				id: 'e2e-registration-slot',
				programYear: E2E_PROGRAM_YEAR,
				dateTime: registration.dateTime,
				maxSlots: 5,
				slotsReserved: 2,
			},
			{
				id: 'last-slot',
				programYear: E2E_PROGRAM_YEAR,
				dateTime: e2eDateTime(12, 13, 17),
				maxSlots: 1,
				slotsReserved: 0,
			},
		]);
		const peer = await browser.newContext({
			...devices['Pixel 5'],
			baseURL,
			timezoneId: 'America/Denver',
		});
		try {
			const other = await peer.newPage();
			await signInAdminViaUi(page, defaultAdminAccount());
			await signInAdminViaUi(other, secondStaff);
			await review(page, registration.code);
			await review(other, otherFamily.code);
			for (const operator of [page, other]) {
				await operator
					.getByRole('button', {
						name: 'Change Date/Time',
						exact: true,
					})
					.click();
				const day = operator.locator('ion-modal ion-accordion').last();
				await day.locator('ion-item[slot="header"]').click();
				await day
					.locator('ion-list[slot="content"] ion-item')
					.first()
					.click();
				await expect(operator.locator('ion-alert')).toContainText(
					'Confirm Changes',
				);
			}
			// Both confirmation dialogs hold the last available slot before either write.
			await Promise.all(
				[page, other].map((operator) =>
					operator
						.locator('ion-alert')
						.getByRole('button', { name: 'Continue', exact: true })
						.click(),
				),
			);
			await expect
				.poll(
					async () => {
						const records = await Promise.all(
							[registration, otherFamily].map((family) =>
								inspectRegistrationQrLifecycle(
									family.emailAddress,
								),
							),
						);
						return records.filter(
							(record) =>
								record.registration.dateTimeSlot?.id ===
								'last-slot',
						).length;
					},
					{ timeout: 15000 },
				)
				.toBe(2);
			const records = await Promise.all(
				[registration, otherFamily].map((family) =>
					inspectRegistrationQrLifecycle(family.emailAddress),
				),
			);
			// The backend deliberately leaves counters for scheduled reconciliation.
			// This is evidence of the current soft-capacity contract, not overbooking protection.
			for (const record of records) {
				expect(record.registration.previousDateTimeSlot?.id).toBe(
					'e2e-registration-slot',
				);
				expect(record.slots.current).toMatchObject({
					maxSlots: 1,
					slotsReserved: 0,
				});
				expect(record.slots.previous?.slotsReserved).toBe(2);
			}
		} finally {
			await peer.close();
		}
	});
});
