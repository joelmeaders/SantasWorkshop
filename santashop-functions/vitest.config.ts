import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@santashop/models': fileURLToPath(
				new URL('../santashop-models/src/index.ts', import.meta.url),
			),
		},
	},
	test: {
		environment: 'node',
		globals: true,
		restoreMocks: true,
		clearMocks: true,
		mockReset: true,
		fileParallelism: false,
		maxConcurrency: 1,
		include: ['test/**/*.spec.ts'],
		setupFiles: ['./test/setup/vitest.setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/index.ts', 'src/fn/testHelpers.ts'],
			thresholds: {
				statements: 65,
				branches: 50,
				functions: 70,
				lines: 65,
			},
		},
	},
});
