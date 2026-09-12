import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { storybookAngularVitest } from '@storybook/angular-vite/vitest';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import type { BrowserProviderOption } from 'vitest/node';

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
						// pnpm resolves two Vitest 4.1.10 peer contexts (Node type versions).
						// Their private TypeScript identities differ; the provider API is identical.
						provider: playwright(
							{},
						) as unknown as BrowserProviderOption,
						instances: [{ browser: 'chromium' }],
					},
				},
			},
		],
	},
});
