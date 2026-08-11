import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@santashop/core/customer': fileURLToPath(
				new URL('./santashop-core/src/index.ts', import.meta.url),
			),
			'@santashop/core': fileURLToPath(
				new URL('./santashop-core/src/index.ts', import.meta.url),
			),
			'@santashop/models': fileURLToPath(
				new URL('./santashop-models/src/index.ts', import.meta.url),
			),
		},
	},
	test: {
		setupFiles: ['./vitest.setup.ts'],
		coverage: {
			thresholds: {
				statements: 49,
				branches: 50,
				functions: 30,
				lines: 80,
			},
		},
	},
});
