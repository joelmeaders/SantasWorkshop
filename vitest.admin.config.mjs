import { mergeConfig, defineConfig } from 'vitest/config';
import base from './vitest.config.mjs';

export default mergeConfig(
	base,
	defineConfig({
		test: {
			setupFiles: ['./santashop-admin/src/test-preferences.setup.ts'],
		},
	}),
);
