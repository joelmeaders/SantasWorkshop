// @ts-check
const rootConfig = require('../eslint.config.js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(...rootConfig, {
	files: ['**/*.ts'],
	languageOptions: {
		parserOptions: {
			project: [
				'santashop-app/tsconfig.app.json',
				'santashop-app/tsconfig.spec.json',
			],
		},
	},
	rules: {
		'@angular-eslint/component-selector': [
			'error',
			{
				type: 'element',
				prefix: 'app',
				style: 'kebab-case',
			},
		],
		'@angular-eslint/directive-selector': [
			'error',
			{
				type: 'attribute',
				prefix: 'app',
				style: 'camelCase',
			},
		],
	},
});
