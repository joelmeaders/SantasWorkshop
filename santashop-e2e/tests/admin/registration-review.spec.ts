import { createHash, randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	defaultOwnerAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';
import {
	E2E_AUTH_EMULATOR_URL,
	E2E_FIRESTORE_EMULATOR_URL,
	E2E_PROGRAM_YEAR,
	E2E_PROJECT_ID,
	e2eDateTime,
} from '../../fixtures/season';

const documents = `/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents`;
const reviewPath = '/admin/stats/registration-review';
const fixtureHeader = { Authorization: 'Bearer owner' };
interface FirestoreValue {
	readonly stringValue?: string;
	readonly booleanValue?: boolean;
	readonly integerValue?: string;
	readonly doubleValue?: number;
	readonly timestampValue?: string;
	readonly mapValue?: { readonly fields: Record<string, FirestoreValue> };
	readonly arrayValue?: { readonly values: readonly FirestoreValue[] };
}

function values(
	input: Record<string, unknown>,
): Record<string, FirestoreValue> {
	return Object.fromEntries(
		Object.entries(input).map(([key, value]) => [key, encode(value)]),
	);
}

function encode(value: unknown): FirestoreValue {
	if (typeof value === 'string') return { stringValue: value };
	if (typeof value === 'boolean') return { booleanValue: value };
	if (typeof value === 'number')
		return Number.isInteger(value)
			? { integerValue: String(value) }
			: { doubleValue: value };
	if (Array.isArray(value))
		return { arrayValue: { values: value.map(encode) } };
	if (value !== null && typeof value === 'object')
		return {
			mapValue: { fields: values(value as Record<string, unknown>) },
		};
	throw new Error('Unexpected registration review fixture value.');
}

async function firestore(
	request: APIRequestContext,
	path: string,
): Promise<unknown> {
	const response = await request.get(
		`${E2E_FIRESTORE_EMULATOR_URL}${documents}/${path}`,
		{ headers: fixtureHeader },
	);
	expect(response.ok()).toBe(true);
	return response.json();
}

async function replaceDocument(
	request: APIRequestContext,
	path: string,
	fields: Record<string, unknown>,
	mask?: string,
): Promise<void> {
	const response = await request.patch(
		`${E2E_FIRESTORE_EMULATOR_URL}${documents}/${path}${mask ? '?updateMask.fieldPaths=' + mask : ''}`,
		{ headers: fixtureHeader, data: { fields: values(fields) } },
	);
	expect(response.ok()).toBe(true);
}

// Execute with SANTASHOP_REGISTRATION_REVIEW_ENABLED=true for both the
// prepared Admin build and the demo-santashop Functions emulator.
test.describe('registration review through the signed-in Admin workspace', () => {
	test.skip(
		process.env['SANTASHOP_REGISTRATION_REVIEW_ENABLED'] !== 'true',
		'Registration review E2E requires explicit emulator opt-in.',
	);

	test('REVIEW-001 rejects a plain Admin in both navigation and direct route', async ({
		page,
		seedPublicParams,
		seedAdminUser,
		clearData,
	}) => {
		await clearData();
		await seedPublicParams({});
		const account = defaultAdminAccount();
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);
		await expect(page.locator('#registrationReviewNav')).toHaveCount(0);
		await page.goto(reviewPath);
		await expect(page).toHaveURL(/\/admin\/landing$/);
	});

	test('REVIEW-003 permits delegated Admin review without Owner access', async ({
		page,
		seedPublicParams,
		seedAdminUser,
		clearData,
	}) => {
		await clearData();
		await seedPublicParams({});
		const account = defaultAdminAccount({
			roles: ['admin', 'registration-review'],
		});
		await seedAdminUser(account);
		await signInAdminViaUi(page, account);
		await page.locator('#registrationReviewNav').click();
		await expect(page).toHaveURL(/\/admin\/stats\/registration-review$/);
		await expect(
			page.getByRole('heading', { name: 'Find a case' }),
		).toBeVisible();
		await expect(page.getByText(/no cases in this view/i)).toBeVisible();
	});

	test('REVIEW-004 keeps plaintext email blocks private from shopper and staff clients', async ({
		request,
		seedAdminUser,
		clearData,
	}) => {
		expect(E2E_PROJECT_ID).toBe('demo-santashop');
		expect(new URL(E2E_AUTH_EMULATOR_URL).hostname).toBe('127.0.0.1');
		expect(new URL(E2E_FIRESTORE_EMULATOR_URL).hostname).toBe('127.0.0.1');
		await clearData();
		const suffix = randomUUID();
		const path = 'registrationReviewEmailBlocks/rules-' + suffix;
		const blockedEmail = 'blocked-' + suffix + '@example.test';
		await replaceDocument(request, path, {
			email: blockedEmail,
			active: true,
		});
		try {
			for (const account of [
				defaultAdminAccount({
					uid: 'rules-shopper-' + suffix,
					emailAddress: 'shopper-' + suffix + '@example.test',
					roles: [],
				}),
				defaultAdminAccount({
					uid: 'rules-reviewer-' + suffix,
					emailAddress: 'reviewer-' + suffix + '@example.test',
					roles: ['admin', 'registration-review'],
				}),
			]) {
				await seedAdminUser(account);
				const signIn = await request.post(
					E2E_AUTH_EMULATOR_URL +
						'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
					{
						data: {
							email: account.emailAddress,
							password: account.password,
							returnSecureToken: true,
						},
					},
				);
				expect(signIn.ok()).toBe(true);
				const { idToken } = (await signIn.json()) as {
					idToken: string;
				};
				const response = await request.get(
					`${E2E_FIRESTORE_EMULATOR_URL}${documents}/${path}`,
					{ headers: { Authorization: `Bearer ${idToken}` } },
				);
				expect(response.status()).toBe(403);
				expect(await response.text()).not.toContain(blockedEmail);
			}
		} finally {
			await request.delete(
				`${E2E_FIRESTORE_EMULATOR_URL}${documents}/${path}`,
				{ headers: fixtureHeader },
			);
		}
	});

	test('REVIEW-002 uses real prefix search and safely applies review actions', async ({
		page,
		request,
		seedPublicParams,
		seedAdminUser,
		seedDateTimeSlots,
		seedRegistration,
		clearData,
	}) => {
		// The seed and verification may never visit a real Firestore endpoint.
		expect(E2E_PROJECT_ID).toBe('demo-santashop');
		expect(new URL(E2E_FIRESTORE_EMULATOR_URL).hostname).toBe('127.0.0.1');
		await clearData();
		await seedPublicParams({});
		const account = defaultOwnerAccount({ roles: [] });
		await seedAdminUser(account);
		const suffix = randomUUID().slice(0, 8);
		const left = 'review-left-' + suffix;
		const right = 'review-right-' + suffix;
		const caseId = createHash('sha256')
			.update(left + right)
			.digest('hex');
		const caseDoc =
			'registrationReviewSeasons/' +
			E2E_PROGRAM_YEAR +
			'/cases/' +
			caseId;
		const at = e2eDateTime(11, 16, 18);
		const leftEmail = 'reviewleft-' + suffix + '@example.test';
		const rightEmail = 'reviewright-' + suffix + '@example.test';
		const dateTime = e2eDateTime(12, 11, 17);
		await seedDateTimeSlots([
			{
				id: 'e2e-registration-slot',
				programYear: E2E_PROGRAM_YEAR,
				dateTime,
				slotsReserved: 2,
				maxSlots: 1,
				enabled: true,
			},
		]);
		const testDenylist =
			process.env['SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED'] ===
			'true';
		const shopperPassword = 'FixturePass123!';
		if (testDenylist) {
			expect(new URL(E2E_AUTH_EMULATOR_URL).hostname).toBe('127.0.0.1');
			await seedAdminUser({
				uid: left,
				emailAddress: leftEmail,
				password: shopperPassword,
				roles: [],
			});
		}
		const leftChildren = ['Ari', 'Jules'].map((firstName) => ({
			firstName,
			lastName: 'Fixture',
			dateOfBirth: '2018-05-15',
			ageGroup: '8-9',
			toyType: 'girls',
			enabled: true,
		}));
		for (const [uid, emailAddress, firstName, children] of [
			[left, leftEmail, 'Morgan', leftChildren],
			[
				right,
				rightEmail,
				'Harper',
				[...leftChildren, { ...leftChildren[0], firstName: 'Ren' }],
			],
		] as const) {
			await seedRegistration({
				uid,
				firstName,
				lastName: 'Fixture',
				emailAddress,
				zipCode: '80200',
				code: uid === left ? 'RV001' : 'RV002',
				dateTime,
				children: [...children],
			});
		}
		await replaceDocument(request, caseDoc, {
			id: caseId,
			season: E2E_PROGRAM_YEAR,
			registrations: [left, right],
			tier: 'strict',
			status: 'new',
			lastActionAt: at,
			history: [{ type: 'flagged', at }],
			evidence: {
				firstNameMatches: 2,
				exactDateMatches: 2,
				fullNameMatches: 2,
				dobConflicts: 0,
				missingDobComparisons: 0,
				sameAdultName: false,
				reliableContact: false,
				sameZip: true,
				rosterSizes: [2, 3],
			},
			hasOpenStatus: true,
			tierRank: 0,
			fullRosterFraction: 2 / 3,
			leftId: left,
			rightId: right,
			searchReferences: [caseId, left, right],
		});
		try {
			await signInAdminViaUi(page, account);
			await page.locator('#registrationReviewNav').click();
			await expect(page).toHaveURL(
				/\/admin\/stats\/registration-review$/,
			);
			const queue = page.getByRole('region', { name: 'Find a case' });
			const search = queue.getByRole('searchbox', {
				name: /search by case id, registration id, or email/i,
			});
			await queue
				.getByRole('combobox', { name: /search type/i })
				.selectOption('email-prefix');
			await search.fill('re');
			await queue.getByRole('button', { name: /^search$/i }).click();
			await expect(queue.getByRole('alert')).toContainText(/at least 3/i);
			await search.fill(' REVIEWRIGHT-' + suffix.toUpperCase() + ' ');
			await queue.getByRole('button', { name: /^search$/i }).click();
			await expect(queue.locator('button.case')).toHaveCount(1);
			await queue
				.getByRole('button', { name: new RegExp(caseId) })
				.click();
			expect(page.url()).not.toContain(suffix);
			const detail = page.getByRole('region', {
				name: 'Compare registrations',
			});
			await expect(
				detail.getByText('2 Children', { exact: false }),
			).toBeVisible();
			await expect(
				detail.getByText('3 Children', { exact: false }),
			).toBeVisible();

			const notes = detail.getByRole('region', {
				name: /internal notes/i,
			});
			await notes
				.getByRole('textbox', { name: /add an internal note/i })
				.fill('Synthetic second-review note.');
			await notes.getByRole('button', { name: /add note/i }).click();
			await expect(
				notes.getByText('Synthetic second-review note.'),
			).toBeVisible();

			const target = detail.getByRole('article', { name: left });
			const reviewTools = target.getByRole('region', {
				name: /registration actions/i,
			});
			const disable = reviewTools.getByRole('button', {
				name: new RegExp('Disable shopper access.*' + left, 'i'),
			});
			await disable.click();
			const dialog = page.getByRole('dialog', {
				name: /disable shopper access/i,
			});
			await expect(
				dialog.getByRole('checkbox', { name: /also send/i }),
			).not.toBeChecked();
			await expect(
				dialog.getByRole('button', {
					name: /^Disable shopper access$/i,
				}),
			).toBeDisabled();
			await dialog
				.getByRole('combobox', { name: /reason/i })
				.selectOption('duplicate-registration');
			await replaceDocument(
				request,
				'registrations/' + left,
				{ firstName: 'Morgan Changed' },
				'firstName',
			);
			await dialog
				.getByRole('button', { name: /^Disable shopper access$/i })
				.click();
			await expect(dialog.getByRole('alert')).toContainText(
				/not confirmed/i,
			);
			const actions = (await firestore(
				request,
				caseDoc + '/actions',
			)) as { documents?: { name: string }[] };
			expect(actions.documents ?? []).toHaveLength(0);
			await dialog
				.getByRole('button', { name: /go back without saving/i })
				.click();
			await page.reload();
			await queue
				.getByRole('button', { name: new RegExp(caseId) })
				.click();
			await disable.click();
			await dialog
				.getByRole('combobox', { name: /reason/i })
				.selectOption('duplicate-registration');
			await dialog
				.getByRole('button', { name: /^Disable shopper access$/i })
				.click();
			await expect(
				detail.getByText(
					/Action recorded. No shopper email was requested./i,
				),
			).toBeVisible();
			await expect(
				reviewTools.getByRole('button', {
					name: new RegExp('Restore shopper access.*' + left, 'i'),
				}),
			).toBeVisible();
			const saved = (await firestore(request, caseDoc + '/actions')) as {
				documents: { name: string }[];
			};
			expect(saved.documents).toHaveLength(1);
			const actionId = saved.documents[0].name.split('/').at(-1);
			const delivery = (await firestore(
				request,
				caseDoc + '/actions/' + actionId + '/email',
			)) as { documents?: unknown[] };
			expect(delivery.documents ?? []).toHaveLength(0);

			await reviewTools
				.getByRole('button', {
					name: new RegExp('Restore shopper access.*' + left, 'i'),
				})
				.click();
			const restore = page.getByRole('dialog', {
				name: /restore shopper access/i,
			});
			await expect(
				restore.getByText('Reviewed and cleared'),
			).toBeVisible();
			await restore.getByRole('checkbox', { name: /also send/i }).check();
			await expect(
				restore.getByText(leftEmail, { exact: true }),
			).toBeVisible();
			await expect(
				restore.getByText(rightEmail, { exact: false }),
			).toHaveCount(0);
			await restore
				.getByRole('textbox', { name: /custom message/i })
				.fill('Synthetic note for this shopper only.');
			await restore
				.getByRole('button', {
					name: /^Restore shopper access and queue email$/i,
				})
				.click();
			await expect(
				detail.getByText(/action recorded. shopper email queued./i),
			).toBeVisible();
			const actionReceipts = (await firestore(
				request,
				caseDoc + '/actions',
			)) as {
				documents: {
					name: string;
					fields: {
						action?: FirestoreValue;
						result?: FirestoreValue;
					};
				}[];
			};
			const restored = actionReceipts.documents.find(
				({ fields }) =>
					fields.action?.stringValue === 'enable' ||
					fields.result?.mapValue?.fields['action']?.stringValue ===
						'enable',
			);
			expect(restored).toBeDefined();
			const emailDoc =
				caseDoc +
				'/actions/' +
				restored?.name.split('/').at(-1) +
				'/email/delivery';
			await expect
				.poll(async () => {
					const result = (await firestore(request, emailDoc)) as {
						fields: Record<string, FirestoreValue>;
					};
					expect(result.fields['recipient'].stringValue).toBe(
						leftEmail,
					);
					expect(result.fields['text'].stringValue).toContain(
						'Synthetic note for this shopper only.',
					);
					expect(result.fields['text'].stringValue).not.toContain(
						rightEmail,
					);
					expect(result.fields['text'].stringValue).not.toContain(
						'reviewed-and-cleared',
					);
					return result.fields['state'].stringValue;
				})
				.toBe('queued');

			const runWithoutEmail = async (
				actionLabel: RegExp,
			): Promise<void> => {
				await reviewTools
					.getByRole('button', {
						name: new RegExp(
							actionLabel.source.replace(/\$/u, '') + '.*' + left,
							'i',
						),
					})
					.click();
				const confirmation = page.getByRole('dialog', {
					name: actionLabel,
				});
				const reason = /reinstate|remove email block/i.test(
					actionLabel.source,
				)
					? 'reviewed-and-cleared'
					: 'duplicate-registration';
				await confirmation
					.getByRole('combobox', { name: /reason/i })
					.selectOption(reason);
				await confirmation
					.getByRole('button', { name: actionLabel })
					.click();
				await expect(confirmation).toHaveCount(0);
			};
			await runWithoutEmail(/^Cancel registration$/i);
			await expect(
				target.getByText('Canceled', { exact: true }),
			).toBeVisible();
			await expect(
				target.getByText('2 Children', { exact: false }),
			).toBeVisible();
			const canceled = (await firestore(
				request,
				'registrations/' + left,
			)) as { fields: Record<string, FirestoreValue> };
			expect(canceled.fields['cancelledOn'].timestampValue).toBeTruthy();
			expect(canceled.fields['dateTimeSlot']).toBeUndefined();

			await runWithoutEmail(/^Reinstate registration$/i);
			await expect(
				target.getByText('Canceled', { exact: true }),
			).toHaveCount(0);
			await expect(
				target.getByText('2 Children', { exact: false }),
			).toBeVisible();
			const reinstated = (await firestore(
				request,
				'registrations/' + left,
			)) as { fields: Record<string, FirestoreValue> };
			expect(
				reinstated.fields['dateTimeSlot'].mapValue?.fields['id']
					.stringValue,
			).toBe('e2e-registration-slot');
			expect(reinstated.fields['qrcode'].stringValue).not.toBe('RV001');
			const overCapacitySlot = (await firestore(
				request,
				'dateTimeSlots/e2e-registration-slot',
			)) as { fields: Record<string, FirestoreValue> };
			expect(
				Number(overCapacitySlot.fields['slotsReserved'].integerValue),
			).toBeGreaterThan(
				Number(overCapacitySlot.fields['maxSlots'].integerValue),
			);

			if (testDenylist) {
				await runWithoutEmail(/^Cancel registration$/i);
				await expect(
					target.getByText('Canceled', { exact: true }),
				).toBeVisible();
				await runWithoutEmail(/^Block email for future seasons$/i);
				await expect(
					target.getByText('Email blocked', { exact: true }),
				).toBeVisible();
				const shopperSignIn = async (): Promise<number> =>
					(
						await request.post(
							E2E_AUTH_EMULATOR_URL +
								'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
							{
								data: {
									email: leftEmail,
									password: shopperPassword,
									returnSecureToken: true,
								},
							},
						)
					).status();
				expect(await shopperSignIn()).toBe(400);
				await runWithoutEmail(/^Remove email block$/i);
				await expect(
					detail.getByText(
						/Email block removed. Verify sign-in separately./i,
					),
				).toBeVisible();
				await expect(
					target.getByText('Email blocked', { exact: true }),
				).toHaveCount(0);
				expect(await shopperSignIn()).toBe(400);
			}
			await detail
				.getByRole('region', { name: 'Record the outcome' })
				.getByRole('combobox', { name: 'Review status' })
				.selectOption('resolved');
			await detail
				.getByRole('button', { name: 'Save review status' })
				.click();
			await expect(
				queue.getByRole('button', { name: new RegExp(caseId) }),
			).toHaveCount(0);
			await expect(
				queue.getByRole('heading', { name: 'Find a case' }),
			).toBeFocused();
			await expect(detail.getByRole('status')).toContainText(
				'Find this case under Resolved or All',
			);
			await queue.getByRole('button', { name: /^resolved$/i }).click();
			await expect(
				queue.getByRole('button', { name: new RegExp(caseId) }),
			).toBeVisible();
		} finally {
			for (const collection of ['notes', 'actions', 'qrIntents']) {
				const sub = await request.get(
					`${E2E_FIRESTORE_EMULATOR_URL}${documents}/${caseDoc}/${collection}`,
					{ headers: fixtureHeader },
				);
				if (sub.ok()) {
					const { documents: entries } = (await sub.json()) as {
						documents?: { name: string }[];
					};
					for (const entry of entries ?? []) {
						if (collection === 'actions') {
							await request.delete(
								`${E2E_FIRESTORE_EMULATOR_URL}/v1/${entry.name}/email/delivery`,
								{ headers: fixtureHeader },
							);
						}
						await request.delete(
							`${E2E_FIRESTORE_EMULATOR_URL}/v1/${entry.name}`,
							{ headers: fixtureHeader },
						);
					}
				}
			}
			await request.delete(
				`${E2E_FIRESTORE_EMULATOR_URL}${documents}/${caseDoc}`,
				{ headers: fixtureHeader },
			);
		}
	});
});
