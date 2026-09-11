import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { functionsRequired, uiTargets } from './ui-targets.mjs';

const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint'))('js-yaml');
const readWorkflow = (name) =>
	load(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));
const pr = readWorkflow('app-pr-validation');
const ui = readWorkflow('ui-target');
const functions = readWorkflow('functions-pr-validation');
const browser = readWorkflow('e2e-target');
const release = readWorkflow('functions-test-and-prod-release');

for (const target of ['app', 'admin'])
	test(`${target} Hosting checksum steps run without ripgrep and reject changed output`, () => {
		const directory = mkdtempSync(join(tmpdir(), 'santashop-checksum-'));
		const output = join(directory, 'dist', `santashop-${target}`);
		const runner = join(directory, 'runner');
		const bash =
			process.platform === 'win32'
				? join(
						process.env['ProgramFiles'] ?? 'C:/Program Files',
						'Git',
						'bin',
						'bash.exe',
					)
				: '/bin/bash';
		const steps = ui.jobs.validate_release.steps;
		const before = steps.find(
			({ name }) =>
				name === 'Record verified Hosting output before emulator tests',
		);
		const after = steps.find(
			({ name }) => name === 'Require unchanged verified Hosting output',
		);
		const execute = (step) =>
			execFileSync(
				bash,
				[
					'--noprofile',
					'--norc',
					'-e',
					'-c',
					// Model a runner without ripgrep even when the developer installed it.
					`rg() { printf 'rg: command not found\\n' >&2; return 127; }\n${step.run}`,
				],
				{
					cwd: directory,
					env: {
						PATH: process.env['PATH'],
						SystemRoot: process.env['SystemRoot'],
						UI_TARGET: target,
						RUNNER_TEMP: runner.replaceAll('\\', '/'),
					},
					stdio: 'pipe',
				},
			);
		try {
			mkdirSync(join(output, '.well-known'), { recursive: true });
			mkdirSync(runner);
			writeFileSync(join(output, 'index.html'), '<html>release</html>');
			const nested = join(output, '.well-known', 'file with spaces.json');
			writeFileSync(nested, '{"release":1}');
			execute(before);
			const manifest = readFileSync(
				join(runner, 'hosting-before-e2e.sha256'),
				'utf8',
			);
			assert.match(manifest, /\.well-known\/file with spaces\.json/);
			execute(after);
			writeFileSync(nested, '{"release":2}');
			assert.throws(() => execute(after), /Command failed/);
			writeFileSync(nested, '{"release":1}');
			writeFileSync(join(output, 'unexpected.js'), 'extra bundle');
			assert.throws(() => execute(after), /Command failed/);
			rmSync(join(output, 'unexpected.js'));
			rmSync(nested);
			assert.throws(() => execute(after), /Command failed/);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

test('isolated browser job can build real app and Functions configuration without caller environment', () => {
	execFileSync(
		process.execPath,
		[
			'-e',
			`
		const assert = require('node:assert/strict');
		const client = require('./config.firebase.cjs');
		const backend = require('./config.functions.cjs');
		for (const target of ['app', 'admin']) {
			const config = client.buildAppConfig(target, 'e2e');
			assert.equal(config.programYear, Number(process.env.LOCAL_SANTASHOP_PROGRAM_YEAR));
			assert.ok(config.shopDays.length > 0);
		}
		assert.equal(client.buildFirebaseClientConfig('e2e').projectId, 'demo-santashop');
		assert.equal(backend.buildFunctionsConfig('local').SANTASHOP_PROGRAM_YEAR, process.env.TEST_SANTASHOP_PROGRAM_YEAR);
	`,
		],
		{ env: browser.env, stdio: 'pipe' },
	);
});

// Evaluate the actual job condition with synthetic GitHub results. This checks
// that deliberately omitted backend checks do not suppress the browser matrix,
// while failures and unexpected omissions still prevent it from starting.
const canStartBrowsers = (paths, overrides = {}, cancelled = false) => {
	const needs = Object.fromEntries(
		['targets', 'shared', 'ui', 'functions'].map((name) => [
			name,
			{ result: 'success' },
		]),
	);
	needs.targets.outputs = { functions: String(functionsRequired(paths)) };
	if (!functionsRequired(paths)) needs.functions.result = 'skipped';
	for (const [name, result] of Object.entries(overrides))
		needs[name].result = result;
	return Function(
		'needs',
		'always',
		'cancelled',
		`return (${pr.jobs.e2e.if});`,
	)(
		needs,
		() => true,
		() => cancelled,
	);
};

for (const [name, paths, targets] of [
	[
		'customer plus prose',
		['santashop-app/src/main.ts', 'CHANGELOG.md'],
		['app'],
	],
	[
		'staff plus prose',
		['docs/testing/e2e.md', 'santashop-admin/src/main.ts'],
		['admin'],
	],
	['backend only', ['santashop-functions/src/index.ts'], ['app', 'admin']],
	['shared models', ['santashop-models/src/index.ts'], ['app', 'admin']],
	['security rules', ['firestore.rules'], ['app', 'admin']],
	['root configuration', ['pnpm-lock.yaml'], ['app', 'admin']],
	[
		'shared browser fixtures',
		['santashop-e2e/fixtures/test-fixtures.ts'],
		['app', 'admin'],
	],
])
	test(`${name} reaches each selected browser suite once`, () => {
		assert.equal(canStartBrowsers(paths), true);
		assert.deepEqual(uiTargets(paths), targets);
		assert.equal(pr.jobs.e2e.uses, './.github/workflows/e2e-target.yml');
		assert.equal(
			pr.jobs.e2e.strategy.matrix,
			'${{ fromJSON(needs.targets.outputs.matrix) }}',
		);
		assert.equal(
			Object.values(pr.jobs).filter(({ uses }) =>
				uses?.endsWith('/e2e-target.yml'),
			).length,
			1,
		);
		const browserStep = ui.jobs.validate_release.steps.find(
			({ name }) => name === 'Customer or staff E2E tests',
		);
		assert.equal(
			browserStep.if,
			'${{ inputs.deploy && !inputs.reuse_tests }}',
		);
		assert.equal(pr.jobs.ui.with.deploy, undefined);
		assert.deepEqual(Object.keys(functions.on), ['workflow_call']);
		assert.equal(
			Object.values(functions.jobs)
				.flatMap(({ steps }) => steps)
				.some(({ run }) => run?.includes('e2e:test')),
			false,
		);
	});

for (const job of ['targets', 'shared', 'ui', 'functions'])
	for (const outcome of ['failure', 'cancelled', 'skipped'])
		test(`${job} ${outcome} prevents backend PR browser execution`, () => {
			assert.equal(
				canStartBrowsers(['santashop-functions/src/index.ts'], {
					[job]: outcome,
				}),
				false,
			);
		});

test('cancelled PR never starts new browser jobs', () => {
	assert.equal(
		canStartBrowsers(['santashop-app/src/main.ts'], {}, true),
		false,
	);
	assert.equal(pr.concurrency['cancel-in-progress'], true);
	assert.ok(
		pr.concurrency.group.includes('github.event.pull_request.number'),
	);
});

test('single PR owner covers backend and shared browser inputs', () => {
	for (const path of [
		'santashop-app/**',
		'santashop-admin/**',
		'santashop-core/**',
		'santashop-models/**',
		'santashop-functions/**',
		'santashop-e2e/**',
		'firestore.rules',
		'firestore.indexes.json',
		'storage.rules',
		'database.rules.json',
		'firebase.json',
		'firebase.e2e.json',
		'config.functions.cjs',
		'config.firebase.cjs',
		'pnpm-lock.yaml',
		'pnpm-workspace.yaml',
		'.github/workflows/functions-pr-validation.yml',
		'.github/workflows/e2e-target.yml',
	])
		assert.ok(pr.on.pull_request.paths.includes(path), path);
});

test('release browser targets use separate runners and accept no deployment secrets', () => {
	assert.deepEqual(release.jobs.e2e.strategy.matrix.target, ['app', 'admin']);
	assert.equal(release.jobs.e2e.strategy['fail-fast'], false);
	assert.equal(browser.jobs.test['runs-on'], 'ubuntu-latest');
	assert.equal(browser.on.workflow_call.secrets, undefined);
	assert.equal(pr.jobs.e2e.secrets, undefined);
	assert.equal(release.jobs.e2e.secrets, undefined);
	assert.equal(browser.env.LOCAL_AWS_ACCESS_KEY_ID, 'e2e-not-used');
	assert.equal(browser.env.LOCAL_AWS_SECRET_ACCESS_KEY, 'e2e-not-used');
	const checkout = browser.jobs.test.steps.find(({ uses }) =>
		uses?.startsWith('actions/checkout@'),
	);
	assert.equal(checkout.with.ref, '${{ inputs.release_ref }}');
	const config = readFileSync('santashop-e2e/playwright.config.ts', 'utf8');
	assert.match(config, /fullyParallel: false/);
	assert.match(config, /workers: 1/);
});

test('final PR check depends on every validation job, including E2E', () => {
	assert.equal(pr.jobs.build_validation.if, 'always()');
	assert.deepEqual(pr.jobs.build_validation.needs, [
		'targets',
		'shared',
		'ui',
		'functions',
		'e2e',
	]);
	const check = pr.jobs.build_validation.steps[0].run;
	for (const job of ['targets', 'shared', 'ui', 'e2e'])
		assert.ok(
			check.includes(`test '\${{ needs.${job}.result }}' = success`),
		);
	assert.ok(
		check.includes("true) test '${{ needs.functions.result }}' = success"),
	);
	assert.ok(
		check.includes("false) test '${{ needs.functions.result }}' = skipped"),
	);
});
