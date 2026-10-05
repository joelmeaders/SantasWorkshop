import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { storybookAngularVitest } from '@storybook/angular-vite/vitest';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import type { BrowserProviderOption } from 'vitest/node';

import { storybookTargets } from './.storybook/targets';

const workspaceDirectory = path.dirname(fileURLToPath(import.meta.url));
const targets = storybookTargets();

export default defineConfig({
	test: {
		projects: [
			{
				extends: true,
				// Prebundle browser audit and fixture dependencies before tests start.
				// Discovering them during a run reloads active test pages.
				optimizeDeps: {
					include: [
						'@storybook/addon-a11y > axe-core',
						'@angular/common/testing',
						'firebase/storage',
						...(targets.includes('admin')
							? [
									'@codemirror/lang-html',
									'@codemirror/language',
									'@codemirror/state',
									'@codemirror/view',
									'@lezer/highlight',
									'@zxing/ngx-scanner',
									'chartjs-plugin-datalabels',
									'codemirror',
									'ng2-charts',
								]
							: []),
					],
				},
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
