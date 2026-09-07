import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/angular-vite';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = path.resolve(configDirectory, '..');

const config: StorybookConfig = {
	stories: [
		'./Introduction.mdx',
		'../santashop-app/src/**/*.stories.ts',
		'../santashop-admin/src/**/*.stories.ts',
	],
	addons: [
		'@storybook/addon-docs',
		'@storybook/addon-a11y',
		'@storybook/addon-vitest',
	],
	core: { disableTelemetry: true },
	framework: {
		name: '@storybook/angular-vite',
		options: {
			tsconfig: path.resolve(
				workspaceDirectory,
				'tsconfig.storybook.json',
			),
		},
	},
	staticDirs: [
		{ from: '../santashop-app/src/assets', to: '/assets' },
		{ from: '../santashop-admin/src/assets', to: '/assets' },
		{ from: '../node_modules/ionicons/dist/ionicons/svg', to: '/svg' },
	],
	async viteFinal(viteConfig) {
		const { mergeConfig } = await import('vite');

		return mergeConfig(viteConfig, {
			resolve: {
				alias: [
					{
						find: /^@santashop\/core\/admin\/firestore$/,
						replacement: path.resolve(
							workspaceDirectory,
							'santashop-core/src/admin-firestore.ts',
						),
					},
					{
						find: /^@santashop\/core\/admin$/,
						replacement: path.resolve(
							workspaceDirectory,
							'santashop-core/src/admin.ts',
						),
					},
					{
						find: /^@santashop\/core\/customer$/,
						replacement: path.resolve(
							workspaceDirectory,
							'santashop-core/src/customer.ts',
						),
					},
					{
						find: /^@santashop\/core$/,
						replacement: path.resolve(
							workspaceDirectory,
							'santashop-core/src/index.ts',
						),
					},
					{
						find: /^@santashop\/models$/,
						replacement: path.resolve(
							workspaceDirectory,
							'dist/@santashop/models',
						),
					},
					{
						find: /^test-helpers\/(.+)$/,
						replacement: path.resolve(
							workspaceDirectory,
							'test-helpers/$1',
						),
					},
				],
			},
		});
	},
};

export default config;
