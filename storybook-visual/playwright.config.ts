import path from 'node:path';

import { defineConfig } from '@playwright/test';

const configDirectory = __dirname;
const port = Number.parseInt(process.env['STORYBOOK_PORT'] ?? '6007', 10);
const baseURL = process.env['STORYBOOK_BASE_URL'] ?? `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: path.resolve(configDirectory, 'tests'),
	testMatch: '**/*.spec.ts',
	testIgnore: '**/fixtures/**',
	fullyParallel: false,
	forbidOnly: Boolean(process.env['CI']),
	retries: 0,
	workers: Number.parseInt(process.env['STORYBOOK_WORKERS'] ?? '1', 10),
	timeout: 90_000,
	expect: {
		timeout: 15_000,
		toHaveScreenshot: {
			animations: 'disabled',
			caret: 'hide',
			scale: 'css',
			maxDiffPixels: 0,
		},
	},
	reporter: process.env['CI']
		? [['list']]
		: [
				['list'],
				[
					'html',
					{
						outputFolder: path.resolve(configDirectory, 'report'),
						open: 'never',
					},
				],
			],
	use: {
		baseURL,
		headless: true,
		timezoneId: 'America/Denver',
		locale: 'en-US',
		colorScheme: 'light',
		deviceScaleFactor: 1,
		navigationTimeout: 30_000,
		actionTimeout: 15_000,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'off',
	},
	updateSnapshots: 'none',
	outputDir: path.resolve(configDirectory, 'test-results'),
	webServer: process.env['STORYBOOK_BASE_URL']
		? undefined
		: {
				command: 'node serve-storybook.mjs',
				url: baseURL,
				timeout: 30_000,
				reuseExistingServer: false,
			},
	snapshotDir: path.resolve(configDirectory, 'snapshots'),
	snapshotPathTemplate: '{snapshotDir}/{platform}/{projectName}/{arg}{ext}',
	projects: [
		{
			name: 'desktop',
			use: { viewport: { width: 1440, height: 900 } },
		},
		{
			name: 'mobile',
			use: { viewport: { width: 390, height: 844 }, isMobile: true },
		},
	],
});
