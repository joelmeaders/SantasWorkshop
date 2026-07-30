import {
	defineConfig,
	devices,
	type ReporterDescription,
} from '@playwright/test';

const reporters: ReporterDescription[] = process.env['CI']
	? [['list', {}]]
	: [
			['html', { outputFolder: 'playwright-report', open: 'never' }],
			['list', {}],
		];

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4100';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './tests',

	/* Firebase emulators are shared mutable state, so keep e2e execution sequential. */
	fullyParallel: false,

	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env['CI'],

	/* Fail fast for quicker e2e feedback loops. */
	retries: 0,

	/* Use a single worker because tests share the same emulator instance and seeded documents. */
	workers: 1,

	/* Reporter to use. Keep CI runs non-interactive. */
	reporter: reporters,

	/* Maximum time one test can run for */
	timeout: 60000,

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL,

		/* Keep browser execution headless for CI-safe, non-interactive runs. */
		headless: true,

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',

		/* Screenshot on failure */
		screenshot: 'only-on-failure',

		/* Video on failure */
		video: 'retain-on-failure',

		/* Navigation timeout */
		navigationTimeout: 30000,

		/* Action timeout */
		actionTimeout: 10000,
	},

	/*
	 * Most customers use the application on a phone. Keep the integrated suite
	 * on one Chromium-backed mobile profile for fast, representative feedback.
	 */
	projects: [
		{
			name: 'mobile-chrome',
			use: { ...devices['Pixel 5'] },
		},
	],

	/* Run your local dev server before starting the tests */
	// Note: We don't use webServer here because we need to coordinate
	// building functions and starting emulators before starting the app.
	// This is handled by the npm scripts in the root package.json
});
