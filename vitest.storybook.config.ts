import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { storybookAngularVitest } from '@storybook/angular-vite/vitest';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const workspaceDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		projects: [
			{
				extends: true,
				plugins: [
					storybookAngularVitest({
						zoneless: true,
					}),
					storybookTest({
						configDir: path.join(workspaceDirectory, '.storybook'),
					}),
				],
				test: {
					name: 'storybook',
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [{ browser: 'chromium' }],
					},
				},
			},
		],
	},
});
