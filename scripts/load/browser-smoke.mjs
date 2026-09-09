import { chromium, expect } from '@playwright/test';
import { createAccountViaUi } from '../../santashop-e2e/fixtures/account-helpers.ts';
import {
	addChildViaUi,
	submitRegistrationViaUi,
} from '../../santashop-e2e/fixtures/registration-helpers.ts';
import { childFixture, isCustomerCallable } from './config.mjs';

export async function browserSmoke(
	config,
	fixture,
	slotId,
	year,
	journal,
	outputDirectory,
) {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		baseURL: config.customerOrigin,
	});
	await context.route(
		(url) => isCustomerCallable(config, url.href, 'POST'),
		async (route) => {
			if (route.request().method() !== 'POST') {
				await route.continue();
				return;
			}
			try {
				journal.assertRunning();
			} catch {
				await route.abort('aborted');
				return;
			}
			await route.continue();
		},
	);
	const page = await context.newPage();
	const requests = new Map();
	const pending = [];
	let hasAppCheck = false;
	page.on('request', (request) => {
		if (isCustomerCallable(config, request.url(), request.method())) {
			requests.set(request, performance.now());
			hasAppCheck ||= Boolean(request.headers()['x-firebase-appcheck']);
		}
	});
	page.on('response', (response) => {
		const request = response.request();
		if (!requests.has(request)) return;
		pending.push(
			(async () => {
				const operation = new URL(request.url()).pathname.slice(1);
				const body = await response.json().catch(() => ({}));
				journal.record({
					type: 'request',
					phase: 'browser-smoke',
					operation,
					durationMs: performance.now() - requests.get(request),
					ok: response.ok() && !body.error,
					status: response.status(),
					errorCode: body.error?.status,
					appCheckPresent: Boolean(
						request.headers()['x-firebase-appcheck'],
					),
				});
				if (
					operation === 'newAccount' &&
					typeof (body.result ?? body.data) === 'string'
				) {
					fixture.uid = body.result ?? body.data;
					journal.record({
						type: 'account-created',
						fixture: fixture.id,
						uid: fixture.uid,
						phase: 'browser-smoke',
					});
				}
			})(),
		);
	});
	try {
		journal.assertRunning();
		journal.record({
			type: 'account-intent',
			fixture: fixture.id,
			emailAddress: fixture.emailAddress,
			phase: 'browser-smoke',
		});
		await createAccountViaUi(page, fixture);
		for (let index = 0; index < 3; index++)
			await addChildViaUi(page, childFixture(year, index));
		await page.goto('/pre-registration/overview#appointment');
		const slot = page.locator(`[data-select-slot-id="${slotId}"]`);
		await slot
			.locator('xpath=ancestor::ion-accordion')
			.locator('ion-item[slot="header"]')
			.click();
		await slot.click();
		await submitRegistrationViaUi(page);
		await expect(page.locator('#registrationQrCode')).toBeVisible();
		if (!hasAppCheck)
			throw new Error('Hosted browser did not send App Check.');
		await page.screenshot({
			path: `${outputDirectory}/${fixture.id}.png`,
			fullPage: true,
		});
		await Promise.all(pending);
		if (!fixture.uid)
			throw new Error('Browser account UID was not recorded.');
		journal.record({
			type: 'registration-completed',
			fixture: fixture.id,
			uid: fixture.uid,
			phase: 'browser-smoke',
		});
	} catch (error) {
		await page
			.screenshot({
				path: `${outputDirectory}/${fixture.id}-failure.png`,
				fullPage: true,
			})
			.catch(() => {});
		await Promise.allSettled(pending);
		throw error;
	} finally {
		await context.close();
		await browser.close();
	}
}
