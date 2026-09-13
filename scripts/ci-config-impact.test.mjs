import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { configImpact } from './ci-config-impact.mjs';
import { selectChanges } from './ui-targets.mjs';

const require = createRequire(import.meta.url);
const { load, dump } = createRequire(require.resolve('eslint'))('js-yaml');
const SHARED = 'scripts/__shared-input__';
const input = (name) => `santashop-${name}/__build-input__`;
const json = JSON.stringify;
const reader = (files) => (path) =>
	files[path] === undefined ? undefined : json(files[path]);
const readRepository = (path) => {
	try {
		return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
	} catch {
		return undefined;
	}
};
const manifests = {
	'package.json': {
		devDependencies: {
			'@angular/build': 'catalog:',
			storybook: 'catalog:',
		},
	},
	'santashop-app/package.json': { dependencies: { firebase: 'catalog:' } },
	'santashop-admin/package.json': {
		dependencies: { firebase: 'catalog:', 'chart.js': 'catalog:' },
	},
	'santashop-functions/package.json': {
		dependencies: { firebase: 'catalog:functions' },
	},
};

const noWork = {
	ui: [],
	e2e: [],
	storybook: [],
	shared: false,
	functions: false,
	tooling: false,
	deploy: [],
};

test('leaf app and admin package tests select only their own validation', () => {
	for (const project of ['app', 'admin']) {
		for (const name of [
			'test',
			'test:unit',
			'pretest',
			'lint',
			'lint:check',
		]) {
			const paths = configImpact(
				`santashop-${project}/package.json`,
				json({ scripts: { [name]: 'before' } }),
				json({ scripts: { [name]: 'after' } }),
			);
			assert.deepEqual(selectChanges(paths), {
				...noWork,
				ui: [project],
			});
		}
	}
});

test('leaf Functions test scripts and test tools run Functions tests without deployment', () => {
	for (const after of [
		{ scripts: { 'test:unit': 'new command' } },
		{ devDependencies: { vitest: 'catalog:functions' } },
		{ devDependencies: { eslint: 'catalog:functions' } },
	]) {
		const paths = configImpact(
			'santashop-functions/package.json',
			'{}',
			json(after),
		);
		assert.deepEqual(selectChanges(paths), { ...noWork, functions: true });
	}
});

test('leaf app runtime metadata, dependencies, and build scripts select only app consumers', () => {
	for (const after of [
		{ version: '2' },
		{ name: '@santashop/renamed' },
		{ scripts: { prebuild: 'new build step' } },
		{ scripts: { 'config:prod': 'new config' } },
		{ dependencies: { firebase: 'new' } },
		{ devDependencies: { typescript: 'new' } },
	]) {
		const paths = configImpact(
			'santashop-app/package.json',
			'{}',
			json(after),
		);
		assert.deepEqual(selectChanges(paths), {
			...noWork,
			ui: ['app'],
			e2e: ['app'],
			storybook: ['app'],
			deploy: ['app'],
		});
	}
});

test('leaf Functions runtime dependencies select backend validation and customer journeys', () => {
	const paths = configImpact(
		'santashop-functions/package.json',
		'{}',
		json({ dependencies: { 'firebase-admin': 'catalog:functions' } }),
	);
	assert.deepEqual(selectChanges(paths), {
		...noWork,
		e2e: ['app', 'admin'],
		functions: true,
		deploy: ['functions'],
	});
});

test('leaf package descriptive metadata changes do not run checks', () => {
	for (const project of [
		'app',
		'admin',
		'functions',
		'core',
		'models',
		'e2e',
	]) {
		assert.deepEqual(
			configImpact(
				`santashop-${project}/package.json`,
				'{}',
				json({
					author: 'Updated author',
					license: 'MIT',
					description: 'Updated description',
				}),
			),
			[],
		);
	}
});

test('leaf E2E package changes select journeys without deployments', () => {
	const paths = configImpact(
		'santashop-e2e/package.json',
		'{}',
		json({ scripts: { test: 'new test runner' } }),
	);
	assert.deepEqual(selectChanges(paths), {
		...noWork,
		e2e: ['app', 'admin'],
	});
});

test('leaf core and models metadata changes preserve shared runtime impact', () => {
	for (const project of ['core', 'models']) {
		const paths = configImpact(
			`santashop-${project}/package.json`,
			json({ version: '1' }),
			json({ version: '2' }),
		);
		const selection = selectChanges(paths);
		assert.equal(selection.shared, true);
		assert.deepEqual(
			selection.deploy,
			project === 'models'
				? ['app', 'admin', 'functions']
				: ['app', 'admin'],
		);
	}
});

test('known root helpers retain runtime callers without expanding sibling E2E suites', () => {
	const before = {
		scripts: {
			'storybook:build': 'old',
			'ci:app:build': 'pnpm run storybook:build',
			'e2e:test:app': 'old',
			'e2e:test': 'pnpm run e2e:test:app && pnpm run e2e:test:admin',
		},
	};
	const after = structuredClone(before);
	after.scripts['storybook:build'] = 'new';
	assert.deepEqual(configImpact('package.json', json(before), json(after)), [
		'.storybook/__tooling__',
		input('app'),
	]);
	const e2e = structuredClone(before);
	e2e.scripts['e2e:test:app'] = 'new';
	assert.deepEqual(configImpact('package.json', json(before), json(e2e)), [
		'santashop-e2e/tests/public/__tooling__',
	]);
});

test('root test scripts stay validation-only when a build invokes them', () => {
	const before = {
		scripts: {
			'ci:app:test': 'old',
			'ci:app:build': 'pnpm run ci:app:test && ng build santashop-app',
		},
	};
	const after = structuredClone(before);
	after.scripts['ci:app:test'] = 'new';
	assert.deepEqual(
		selectChanges(configImpact('package.json', json(before), json(after))),
		{ ...noWork, ui: ['app'] },
	);
});

test('unhandled paths use the path selector; missing or malformed config fails closed', () => {
	assert.equal(configImpact('README.md', '', ''), null);
	assert.deepEqual(configImpact('package.json', '', '{}'), [SHARED]);
	assert.deepEqual(configImpact('package.json', '{}', '{invalid'), [SHARED]);
	assert.deepEqual(configImpact('pnpm-lock.yaml', '[]', '{}'), [SHARED]);
});

test('formatting, object key order and root release metadata do not select deployments', () => {
	assert.deepEqual(
		configImpact(
			'package.json',
			'{"version":"1","scripts":{"app:build":"build"}}',
			'{ "scripts": { "app:build": "build" }, "version": "2" }',
		),
		[],
	);
});

for (const [script, expected] of [
	['ci:app:build:test', input('app')],
	['config:admin:prod', input('admin')],
	['functions:test:unit', 'santashop-functions/__config__.spec.ts'],
	['ci:app:test', 'santashop-app/__config__.spec.ts'],
	['storybook:visual', '.storybook/__tooling__'],
	['e2e:test:app', 'santashop-e2e/tests/public/__tooling__'],
	['e2e:test:admin', 'santashop-e2e/tests/admin/__tooling__'],
	['e2e:functions:ready', 'firebase.e2e.json'],
	['some-new-task', SHARED],
]) {
	test(`root script ${script} selects its consumer`, () => {
		assert.deepEqual(
			configImpact(
				'package.json',
				json({ scripts: { [script]: 'old' } }),
				json({ scripts: { [script]: 'new' } }),
			),
			[expected],
		);
	});
}

test('root runtime dependencies follow package consumers', () => {
	const read = reader(manifests);
	assert.deepEqual(
		configImpact(
			'package.json',
			'{}',
			json({ dependencies: { 'chart.js': 'catalog:' } }),
			read,
			read,
		),
		[input('admin')],
	);
	assert.deepEqual(
		configImpact(
			'package.json',
			'{}',
			json({ dependencies: { firebase: 'catalog:' } }),
			read,
			read,
		),
		[input('admin'), input('app')],
	);
	assert.deepEqual(
		configImpact(
			'package.json',
			'{}',
			json({ devDependencies: { '@angular/build': 'catalog:' } }),
			read,
			read,
		),
		[input('core')],
	);
});

test('unknown installation settings affect all consumers', () => {
	assert.deepEqual(
		configImpact('package.json', '{}', json({ engines: { node: '>=26' } })),
		[SHARED],
	);
	assert.deepEqual(
		configImpact(
			'pnpm-workspace.yaml',
			'packages: []',
			'packages: [new-package]',
		),
		[SHARED],
	);
});

test('Angular project targets separate app, admin, tests, and Storybook', () => {
	const original = {
		projects: {
			'santashop-admin': {
				architect: {
					build: { options: { outputPath: 'old' } },
					test: { options: {} },
					storybook: {},
				},
			},
		},
	};
	for (const [target, expected] of [
		['build', input('admin')],
		['test', 'santashop-admin/__config__.spec.ts'],
		['storybook', '.storybook/__tooling__'],
	]) {
		const after = structuredClone(original);
		after.projects['santashop-admin'].architect[target] = {
			options: { changed: true },
		};
		assert.deepEqual(
			configImpact('angular.json', json(original), json(after)),
			[expected],
		);
	}
});

test('Firebase hosting target changes only select that application', () => {
	const before = {
		hosting: [
			{ target: 'santashop-app', headers: [] },
			{ target: 'santashop-admin', headers: [] },
		],
		functions: { runtime: 'nodejs24' },
	};
	const after = structuredClone(before);
	after.hosting[1].headers.push({ source: '**' });
	assert.deepEqual(configImpact('firebase.json', json(before), json(after)), [
		input('admin'),
	]);
	assert.deepEqual(
		configImpact(
			'firebase.json',
			json(before),
			json({ ...before, functions: { runtime: 'nodejs26' } }),
		),
		[input('functions')],
	);
	assert.deepEqual(
		configImpact(
			'firebase.json',
			json(before),
			json({ ...before, emulators: { auth: { port: 9099 } } }),
		),
		['firebase.e2e.json'],
	);
});

test('Firebase removed targets and changed rules paths retain their consumer', () => {
	assert.deepEqual(
		configImpact(
			'firebase.json',
			json({ hosting: [{ target: 'santashop-app' }] }),
			'{}',
		),
		[input('app')],
	);
	assert.deepEqual(
		configImpact(
			'firebase.json',
			json({ firestore: { rules: 'firestore.rules' } }),
			json({ firestore: { rules: 'new.rules' } }),
		),
		['firestore.rules', 'new.rules'],
	);
	assert.deepEqual(
		configImpact(
			'firebase.json',
			'{}',
			json({ hosting: { public: 'dist/unknown' } }),
		),
		[SHARED],
	);
});

test('catalog selection distinguishes default Firebase from the Functions catalog', () => {
	const before = {
		catalog: { firebase: '1', 'chart.js': '1' },
		catalogs: { functions: { firebase: '1' } },
	};
	const read = reader(manifests);
	const frontend = structuredClone(before);
	frontend.catalog.firebase = '2';
	assert.deepEqual(
		configImpact(
			'pnpm-workspace.yaml',
			dump(before),
			dump(frontend),
			read,
			read,
		),
		[input('admin'), input('app')],
	);
	const backend = structuredClone(before);
	backend.catalogs.functions.firebase = '2';
	assert.deepEqual(
		configImpact(
			'pnpm-workspace.yaml',
			dump(before),
			dump(backend),
			read,
			read,
		),
		[input('functions')],
	);
	const admin = structuredClone(before);
	admin.catalog['chart.js'] = '2';
	assert.deepEqual(
		configImpact(
			'pnpm-workspace.yaml',
			dump(before),
			dump(admin),
			read,
			read,
		),
		[input('admin')],
	);
});

function lockFixture() {
	return {
		lockfileVersion: '9.0',
		settings: { autoInstallPeers: false },
		importers: {
			'.': {
				devDependencies: {
					'@angular/build': {
						specifier: 'catalog:',
						version: '1.0.0',
					},
				},
			},
			'santashop-app': {
				dependencies: {
					frontend: { specifier: '^1', version: '1.0.0(peer@1)' },
				},
			},
			'santashop-admin': {
				dependencies: {
					frontend: { specifier: '^1', version: '1.0.0(peer@1)' },
				},
			},
			'santashop-functions': {
				dependencies: {
					backend: { specifier: '^1', version: '1.0.0' },
				},
			},
		},
		packages: {
			'@angular/build@1.0.0': { resolution: { integrity: 'angular' } },
			'frontend@1.0.0': { resolution: { integrity: 'frontend' } },
			'backend@1.0.0': { resolution: { integrity: 'backend' } },
			'child@1.0.0': { resolution: { integrity: 'child' } },
			'child@2.0.0': { resolution: { integrity: 'child2' } },
		},
		snapshots: {
			'@angular/build@1.0.0': {},
			'frontend@1.0.0(peer@1)': {},
			'backend@1.0.0': { dependencies: { child: '1.0.0' } },
			'child@1.0.0': {},
			'child@2.0.0': {},
		},
	};
}

test('backend transitive updates select Functions even with unchanged importer versions', () => {
	const before = lockFixture();
	const after = structuredClone(before);
	after.snapshots['backend@1.0.0'].dependencies.child = '2.0.0';
	after.overrides = { child: '2.0.0' };
	assert.deepEqual(
		configImpact('pnpm-lock.yaml', dump(before), dump(after)),
		[input('functions')],
	);
});

test('package integrity changes affect every importer that uses the resolved package', () => {
	const before = lockFixture();
	const after = structuredClone(before);
	after.packages['frontend@1.0.0'].resolution.integrity = 'changed';
	assert.deepEqual(
		configImpact('pnpm-lock.yaml', dump(before), dump(after)),
		[input('admin'), input('app')],
	);
});

test('root Angular tooling updates do not select Functions', () => {
	const before = lockFixture();
	const after = structuredClone(before);
	after.packages['@angular/build@1.0.0'].resolution.integrity = 'changed';
	assert.deepEqual(
		configImpact('pnpm-lock.yaml', dump(before), dump(after)),
		[input('core')],
	);
});

test('Functions test tool updates do not deploy Functions', () => {
	const before = lockFixture();
	before.importers['santashop-functions'].devDependencies = {
		vitest: { version: '1.0.0' },
	};
	before.snapshots['vitest@1.0.0'] = {};
	before.packages['vitest@1.0.0'] = { resolution: { integrity: 'vitest' } };
	const after = structuredClone(before);
	after.packages['vitest@1.0.0'].resolution.integrity = 'changed';
	assert.deepEqual(
		configImpact('pnpm-lock.yaml', dump(before), dump(after)),
		['santashop-functions/__config__.spec.ts'],
	);
});

test('workspace links and cyclic dependency edges terminate and preserve impact', () => {
	const before = lockFixture();
	before.importers['santashop-app'].dependencies = {
		backend: { version: 'link:../santashop-functions' },
	};
	before.snapshots['child@1.0.0'].dependencies = { backend: '1.0.0' };
	const after = structuredClone(before);
	after.packages['child@1.0.0'].resolution.integrity = 'changed';
	assert.deepEqual(
		configImpact('pnpm-lock.yaml', dump(before), dump(after)),
		[input('app'), input('functions')],
	);
});

test('missing snapshots, unknown lock versions and global settings fail closed', () => {
	const before = lockFixture();
	for (const mutation of [
		(after) => {
			delete after.snapshots['child@1.0.0'];
		},
		(after) => {
			after.lockfileVersion = '10.0';
		},
		(after) => {
			after.settings.autoInstallPeers = true;
		},
	]) {
		const after = structuredClone(before);
		mutation(after);
		assert.ok(
			configImpact('pnpm-lock.yaml', dump(before), dump(after)).includes(
				SHARED,
			),
		);
	}
});

test('root override changes use the resolved lock graph to preserve Functions isolation', () => {
	const before = lockFixture();
	const after = structuredClone(before);
	after.snapshots['backend@1.0.0'].dependencies.child = '2.0.0';
	after.overrides = { child: '2.0.0' };
	assert.deepEqual(
		configImpact(
			'package.json',
			json({ pnpm: { overrides: { child: '1.0.0' } } }),
			json({ pnpm: { overrides: { child: '2.0.0' } } }),
			(path) => (path === 'pnpm-lock.yaml' ? dump(before) : undefined),
			(path) => (path === 'pnpm-lock.yaml' ? dump(after) : undefined),
		),
		[input('functions')],
	);
});

test('the repository lockfile supports no-op, Functions, and frontend integrity changes', () => {
	const beforeText = readRepository('pnpm-lock.yaml');
	const before = load(beforeText);
	assert.deepEqual(
		configImpact(
			'pnpm-lock.yaml',
			beforeText,
			beforeText,
			readRepository,
			readRepository,
		),
		[],
	);
	for (const [name, expected] of [
		['@aws-sdk/client-ses@', [input('functions')]],
		['@codemirror/view@', [input('admin')]],
	]) {
		const after = structuredClone(before);
		const packageKey = Object.keys(after.packages).find((key) =>
			key.startsWith(name),
		);
		assert.ok(packageKey, `Expected actual package ${name}`);
		after.packages[packageKey].resolution.integrity += '-changed';
		assert.deepEqual(
			configImpact(
				'pnpm-lock.yaml',
				beforeText,
				dump(after),
				readRepository,
				readRepository,
			),
			expected,
		);
	}
});
