import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		setupFiles: ['./vitest.setup.ts'],
		coverage: {
			thresholds: {
				statements: 49,
				branches: 50,
				functions: 30,
				lines: 50,
			},
		},
	},
});
