// @ts-check
const eslint = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');

module.exports = [
	{
		files: ['**/*.ts'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			parser: tsParser,
			parserOptions: {
				project: ['./tsconfig.json'],
			},
			globals: {
				...globals.node,
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
		},
		rules: {
			...eslint.configs.recommended.rules,
			...tsPlugin.configs.recommended.rules,
			'no-floating-decimal': 'error',
			'@typescript-eslint/no-unused-vars': 'error',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'no-return-await': 'off',
			'@typescript-eslint/return-await': ['error'],
			'@typescript-eslint/prefer-readonly': ['error'],
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-member-accessibility': [
				'error',
				{ overrides: { constructors: 'no-public' } },
			],
			'@typescript-eslint/no-explicit-any': ['warn'],
		},
	},
	{
		ignores: ['dist/*', 'node_modules/**', 'webpack.config.mjs'],
	},
];
