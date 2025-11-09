// @ts-check
const rootConfig = require('../eslint.config.js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
	...rootConfig,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: [
					'santashop-admin/tsconfig.app.json',
					'santashop-admin/tsconfig.spec.json',
				],
			},
		},
		rules: {
			'@angular-eslint/component-selector': [
				'error',
				{
					type: 'element',
					prefix: 'admin',
					style: 'kebab-case',
				},
			],
			'@angular-eslint/directive-selector': [
				'error',
				{
					type: 'attribute',
					prefix: 'admin',
					style: 'camelCase',
				},
			],
		},
	},
	{
		files: ['src/test-helpers.ts', '**/*.spec.ts'],
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
);
