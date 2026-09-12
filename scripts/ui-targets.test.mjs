import assert from 'node:assert/strict';
import test from 'node:test';
import { selectChanges } from './ui-targets.mjs';

const empty = {
	ui: [],
	e2e: [],
	storybook: [],
	shared: false,
	functions: false,
	tooling: false,
	deploy: [],
};
const app = {
	...empty,
	ui: ['app'],
	e2e: ['app'],
	storybook: ['app'],
	deploy: ['app'],
};
const admin = {
	...empty,
	ui: ['admin'],
	e2e: ['admin'],
	storybook: ['admin'],
	deploy: ['admin'],
};
for (const [name, paths, expected] of [
	['app only', ['santashop-app/src/main.ts'], app],
	['admin only', ['santashop-admin/src/main.ts'], admin],
	[
		'app plus README',
		[
			'santashop-app/src/main.ts',
			'santashop-app/README.md',
			'CHANGELOG.md',
		],
		app,
	],
	[
		'admin and its E2E',
		[
			'santashop-admin/src/main.ts',
			'santashop-e2e/tests/admin/checkin.spec.ts',
		],
		admin,
	],
	[
		'app E2E only',
		['santashop-e2e/tests/public/signup.spec.ts'],
		{ ...empty, e2e: ['app'] },
	],
	[
		'admin E2E only',
		['santashop-e2e/tests/admin/checkin.spec.ts'],
		{ ...empty, e2e: ['admin'] },
	],
	[
		'shared E2E fixtures',
		['santashop-e2e/fixtures/account.ts'],
		{ ...empty, e2e: ['app', 'admin'] },
	],
	[
		'app unit only',
		['santashop-app/src/main.spec.ts'],
		{ ...empty, ui: ['app'] },
	],
	[
		'app story only',
		['santashop-app/src/main.stories.ts'],
		{ ...empty, storybook: ['app'] },
	],
	[
		'admin snapshot only',
		['storybook-visual/snapshots/windows-2022/mobile/admin-checkin.png'],
		{ ...empty, storybook: ['admin'] },
	],
	[
		'app snapshot only',
		[
			'storybook-visual/snapshots/windows-2022/mobile/registration-home.png',
		],
		{ ...empty, storybook: ['app'] },
	],
	[
		'shared core',
		['santashop-core/src/index.ts'],
		{
			...empty,
			ui: ['app', 'admin'],
			e2e: ['app', 'admin'],
			storybook: ['app', 'admin'],
			shared: true,
			deploy: ['app', 'admin'],
		},
	],
	[
		'backend runtime',
		['santashop-functions/src/index.ts'],
		{
			...empty,
			e2e: ['app', 'admin'],
			functions: true,
			deploy: ['functions'],
		},
	],
	[
		'backend tests',
		['santashop-functions/test/unit/signup.test.ts'],
		{ ...empty, functions: true },
	],
	[
		'backend test config',
		['santashop-functions/__config__.spec.ts'],
		{ ...empty, functions: true },
	],
	[
		'rules',
		['firestore.rules'],
		{ ...empty, e2e: ['app', 'admin'], functions: true, deploy: ['rules'] },
	],
	[
		'CI workflow',
		['.github/workflows/release-gate.yml'],
		{ ...empty, tooling: true },
	],
	['CI selector', ['scripts/ci-changes.mjs'], { ...empty, tooling: true }],
	[
		'prose only',
		[
			'README.md',
			'docs/release-readiness.md',
			'santashop-functions/README.md',
		],
		empty,
	],
	['empty diff', [], empty],
])
	test(name, () => assert.deepEqual(selectChanges(paths), expected));

test('shared models validate and publish all consumers', () => {
	const actual = selectChanges(['santashop-models/src/index.ts']);
	assert.deepEqual(actual.deploy, ['app', 'admin', 'functions']);
	assert.equal(actual.functions, true);
	assert.equal(actual.shared, true);
});
test('unknown executable inputs remain conservative', () =>
	assert.deepEqual(selectChanges(['unknown.mjs']).deploy, [
		'app',
		'admin',
		'functions',
	]));

for (const [path, expected] of [
	[
		'.github/workflows/storybook-pr-validation.yml',
		{ storybook: ['app', 'admin'] },
	],
	['.github/workflows/e2e-target.yml', { e2e: ['app', 'admin'] }],
	[
		'.github/workflows/functions-pr-validation.yml',
		{ functions: true, e2e: ['app', 'admin'] },
	],
	[
		'.github/workflows/admin-test-and-prod-release.yml',
		{ ui: ['admin'], e2e: ['admin'], storybook: ['admin'] },
	],
])
	test('workflow validates its consumer without deployment: ' + path, () =>
		assert.deepEqual(selectChanges([path]), {
			...empty,
			tooling: true,
			...expected,
		}),
	);
