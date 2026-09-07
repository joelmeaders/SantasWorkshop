import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

interface StorybookEntry {
	id: string;
	name: string;
	title: string;
	type: string;
}

interface StorybookIndex {
	entries: Record<string, StorybookEntry>;
}

const fixedNow = 1_768_492_800_000;
const workspaceDirectory = path.resolve(__dirname, '../..');
const storybookIndexPath = path.resolve(
	workspaceDirectory,
	'dist/storybook/index.json',
);
const storybookIndex = JSON.parse(
	readFileSync(storybookIndexPath, 'utf8'),
) as StorybookIndex;
const stories = Object.values(storybookIndex.entries)
	.filter((entry) => entry.type === 'story')
	.sort((left, right) => left.id.localeCompare(right.id));
const baseOrigin = new URL(
	process.env['STORYBOOK_BASE_URL'] ??
		`http://127.0.0.1:${process.env['STORYBOOK_PORT'] ?? '6007'}`,
).origin;
const baseHost = new URL(baseOrigin).host;
const pageFailures = new WeakMap<Page, string[]>();

async function installBrowserGuards(page: Page): Promise<void> {
	const failures: string[] = [];
	pageFailures.set(page, failures);
	await page.clock.setFixedTime(new Date(fixedNow));

	await page.route('**/*', async (route) => {
		const requestURL = new URL(route.request().url());
		const isSameOrigin =
			requestURL.origin === baseOrigin ||
			(['ws:', 'wss:'].includes(requestURL.protocol) &&
				requestURL.host === baseHost);
		const isNonNetwork = ['about:', 'blob:', 'data:'].includes(
			requestURL.protocol,
		);
		if (isNonNetwork || isSameOrigin) {
			await route.continue();
			return;
		}
		failures.push(`External request: ${requestURL.href}`);
		await route.abort('blockedbyclient');
	});

	page.on('pageerror', (error) =>
		failures.push(`Page error: ${error.message}`),
	);
	page.on('console', (message) => {
		const text = message.text();
		const isEmailPreview = new URL(page.url()).searchParams
			.get('id')
			?.startsWith('admin-email-templates-template-editor--');
		const benignSandboxWarning =
			isEmailPreview &&
			(text.startsWith("Blocked script execution in 'about:blank'") ||
				text.startsWith("Blocked script execution in 'about:srcdoc'"));
		if (message.type() === 'error' && !benignSandboxWarning) {
			failures.push(`Console error: ${text}`);
		}
	});
	page.on('requestfailed', (request) => {
		const error = request.failure()?.errorText ?? 'request failed';
		failures.push(`Request failed: ${request.url()} (${error})`);
	});
	page.on('response', (response) => {
		if (response.status() >= 400) {
			failures.push(`HTTP ${response.status()}: ${response.url()}`);
		}
	});
	page.on('dialog', async (dialog) => {
		failures.push(
			`Unexpected dialog: ${dialog.type()} (${dialog.message()})`,
		);
		await dialog.dismiss();
	});
}

async function preparePage(
	page: Page,
	story: StorybookEntry,
): Promise<string[]> {
	await page.goto(
		`/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`,
		{
			waitUntil: 'domcontentloaded',
		},
	);
	await page.locator('#storybook-root').waitFor({ state: 'visible' });
	await page.waitForFunction(() => {
		const root = document.querySelector<HTMLElement>('#storybook-root');
		return Boolean(root && root.childElementCount > 0);
	});
	await page.waitForFunction(
		() => {
			const errorOverlay = Array.from(
				document.querySelectorAll<HTMLElement>('.sb-errordisplay'),
			).some((element) => {
				const style = getComputedStyle(element);
				const bounds = element.getBoundingClientRect();
				return (
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					bounds.width > 0 &&
					bounds.height > 0
				);
			});
			return Boolean(
				document.querySelector(
					'#storybook-root[data-story-audit="passed"]',
				) || errorOverlay,
			);
		},
		undefined,
		{
			timeout: 60_000,
		},
	);
	await page.waitForFunction(() => document.fonts?.status === 'loaded');
	await page.waitForFunction(() =>
		Array.from(document.images).every(
			(image) =>
				image.complete &&
				(image.naturalWidth > 0 || image.src.startsWith('data:')),
		),
	);
	await page.addStyleTag({
		content: `
			*, *::before, *::after {
				animation-duration: 0s !important;
				animation-delay: 0s !important;
				transition-duration: 0s !important;
				transition-delay: 0s !important;
				caret-color: transparent !important;
			}
			html { scroll-behavior: auto !important; }
		`,
	});
	if (process.env['STORYBOOK_VISUAL_MUTATION'] === '1') {
		await page.addStyleTag({
			content:
				'#storybook-root { filter: hue-rotate(180deg) !important; }',
		});
	}
	await page.waitForTimeout(250);

	const storyErrors = await page
		.locator(
			'.sb-errordisplay:visible, [data-testId="error"]:visible, [data-testid="error"]:visible',
		)
		.count();
	const failures = [...(pageFailures.get(page) ?? [])];
	if (storyErrors > 0) failures.push('Storybook rendered an error overlay.');
	return [...new Set(failures)];
}

test.describe('Storybook visual states', () => {
	test.beforeEach(async ({ page }) => installBrowserGuards(page));
	if (stories.length === 0) {
		throw new Error(
			`Storybook index contains no named stories: ${storybookIndexPath}`,
		);
	}

	for (const story of stories) {
		test(`${story.title} / ${story.name}`, async ({ page }) => {
			const errors = await preparePage(page, story);
			expect(
				errors,
				`${story.title} / ${story.name} rendered with errors`,
			).toEqual([]);
			await expect(page).toHaveScreenshot(`${story.id}.png`);
			expect(
				[...new Set(pageFailures.get(page) ?? [])],
				`${story.title} / ${story.name} failed during capture`,
			).toEqual([]);
		});
	}
});
