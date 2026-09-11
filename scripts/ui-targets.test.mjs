import assert from 'node:assert/strict';
import test from 'node:test';
import { functionsRequired, uiTargets } from './ui-targets.mjs';

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
	[
		'customer with root changelog',
		['santashop-app/a.ts', 'CHANGELOG.md'],
		['app'],
	],
	[
		'docs before staff change',
		['docs/release-readiness.md', 'santashop-admin/a.ts'],
		['admin'],
	],
	['customer with root README', ['README.md', 'santashop-app/a.ts'], ['app']],
	[
		'executable docs are not prose',
		['santashop-app/a.ts', 'docs/example.mjs'],
		['app', 'admin'],
	],
	[
		'unknown root prose remains conservative',
		['santashop-app/a.ts', 'unknown.md'],
		['app', 'admin'],
	],
	[
		'backend change with docs',
		['santashop-functions/src/index.ts', 'docs/testing/e2e.md'],
		['app', 'admin'],
	],
	[
		'docs alone fail safe if explicitly invoked',
		['docs/release-readiness.md'],
		['app', 'admin'],
	],
	['empty input fails safe', [], ['app', 'admin']],
])
	test(name, () => assert.deepEqual(uiTargets(paths), expected));

for (const [name, paths, expected] of [
	['customer only', ['santashop-app/a.ts'], false],
	['staff with changelog', ['CHANGELOG.md', 'santashop-admin/a.ts'], false],
	['shared Angular library', ['santashop-core/a.ts'], false],
	['backend source', ['santashop-functions/src/index.ts'], true],
	['shared models', ['santashop-models/src/index.ts'], true],
	[
		'rules with customer change',
		['firestore.rules', 'santashop-app/a.ts'],
		true,
	],
	['browser fixtures', ['santashop-e2e/fixtures/test-fixtures.ts'], true],
	[
		'browser spec',
		['santashop-e2e/tests/public/account-access.spec.ts'],
		true,
	],
	['lockfile', ['pnpm-lock.yaml'], true],
	['workflow', ['.github/workflows/e2e-target.yml'], true],
	['unknown input', ['unknown.mjs'], true],
	['empty input', [], true],
])
	test(`backend selection: ${name}`, () =>
		assert.equal(functionsRequired(paths), expected));
