// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-plugin-prettier/recommended');

module.exports = tseslint.config(
	{
		files: ['**/*.ts'],
		extends: [
			eslint.configs.recommended,
			...tseslint.configs.recommended,
			...tseslint.configs.stylistic,
			...angular.configs.tsRecommended,
			prettier,
		],
		processor: angular.processInlineTemplates,
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			parserOptions: {
				project: true,
			},
		},
		rules: {
			'prettier/prettier': ['off', { endOfLine: 'auto' }],
			'no-floating-decimal': 'error',
			'@typescript-eslint/member-ordering': 'off',
			'@typescript-eslint/no-unused-vars': 'error',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@angular-eslint/component-class-suffix': [
				'error',
				{
					suffixes: ['Page', 'Component'],
				},
			],
			'no-return-await': 'off',
			'@typescript-eslint/return-await': ['error'],
			'@typescript-eslint/prefer-readonly': ['error'],
			'@typescript-eslint/explicit-function-return-type': ['error'],
			'@typescript-eslint/explicit-member-accessibility': [
				'error',
				{ overrides: { constructors: 'no-public' } },
			],
			'@typescript-eslint/no-explicit-any': ['warn'],
		},
	},
	{
		files: ['**/*.html'],
		extends: [
			...angular.configs.templateRecommended,
			...angular.configs.templateAccessibility,
			prettier,
		],
		rules: {
			'prettier/prettier': ['off', { parser: 'angular' }],
		},
	},
	{
		ignores: [
			'projects/**/*',
			'*.spec.ts',
			'**/dist/*',
			'coverage/**',
			'.firebase/**',
			'node_modules/**',
		],
	},
);
