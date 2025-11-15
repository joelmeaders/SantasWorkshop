// @ts-check
const rootConfig = require('../eslint.config.js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(...rootConfig, {
	files: ['**/*.ts'],
	languageOptions: {
		parserOptions: {
			project: [
				'santashop-core/tsconfig.lib.json',
				'santashop-core/tsconfig.spec.json',
			],
		},
	},
	rules: {
		'@angular-eslint/directive-selector': [
			'error',
			{
				type: 'attribute',
				prefix: 'core',
				style: 'camelCase',
			},
		],
		'@angular-eslint/component-selector': [
			'error',
			{
				type: 'element',
				prefix: 'core',
				style: 'kebab-case',
			},
		],
	},
});
