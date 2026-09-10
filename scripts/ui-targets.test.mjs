import assert from 'node:assert/strict';
import test from 'node:test';
import { uiTargets } from './ui-targets.mjs';

for (const [name, paths, expected] of [
	['customer only', ['santashop-app/src/app/home/home.page.ts'], ['app']],
	[
		'admin only',
		['santashop-admin/src/app/pages/admin/search/search.service.ts'],
		['admin'],
	],
	[
		'customer browser tests',
		['santashop-e2e/tests/public/account-access.spec.ts'],
		['app'],
	],
	[
		'staff browser tests',
		['santashop-e2e/tests/admin/search.spec.ts'],
		['admin'],
	],
	[
		'both applications',
		['santashop-app/a.ts', 'santashop-admin/b.ts'],
		['app', 'admin'],
	],
	['shared core', ['santashop-core/src/index.ts'], ['app', 'admin']],
	['Storybook support', ['.storybook/preview.ts'], ['app', 'admin']],
	['workflow-only', ['.github/workflows/ui-target.yml'], ['app', 'admin']],
	['unknown shared input', ['firebase.json'], ['app', 'admin']],
	['empty input fails safe', [], ['app', 'admin']],
])
	test(name, () => assert.deepEqual(uiTargets(paths), expected));
