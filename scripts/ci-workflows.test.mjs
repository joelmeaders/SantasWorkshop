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
import { selectChanges } from './ui-targets.mjs';
import { changeOutputs } from './ci-changes.mjs';
import { requireSelectedChecks } from './ci-results.mjs';

const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint'))('js-yaml');
const readWorkflow = (name) =>
	load(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));
const pr = readWorkflow('app-pr-validation');
const ui = readWorkflow('ui-target');
const functions = readWorkflow('functions-pr-validation');
const browser = readWorkflow('e2e-target');
const release = readWorkflow('functions-test-and-prod-release');

test('test Functions inventory retries listing failures and still requires source parity', () => {
	const directory = mkdtempSync(
		join(tmpdir(), 'santashop-functions-inventory-'),
	);
	const bash =
		process.platform === 'win32'
			? join(
					process.env['ProgramFiles'] ?? 'C:/Program Files',
					'Git',
					'bin',
					'bash.exe',
				)
			: '/bin/bash';
	const step = release.jobs.deploy_test.steps.find(
		({ name }) => name === 'Verify live test Functions match source',
	);
	const cases = [
		{ listFailures: 0, parityFailures: 0, status: 0, counts: '1 1 0' },
		{ listFailures: 1, parityFailures: 0, status: 0, counts: '2 1 1' },
		{ listFailures: 0, parityFailures: 1, status: 0, counts: '2 2 1' },
		{ listFailures: 12, parityFailures: 0, status: 1, counts: '12 0 11' },
		{ listFailures: 0, parityFailures: 12, status: 1, counts: '12 12 11' },
	];
	try {
		for (const scenario of cases) {
			let status = 0;
			try {
				execFileSync(
					bash,
					[
						'--noprofile',
						'--norc',
						'-e',
						'-o',
						'pipefail',
						'-c',
						`
list_attempts=0
parity_attempts=0
sleep_count=0
trap 'printf "%s %s %s" "$list_attempts" "$parity_attempts" "$sleep_count" > "$RUNNER_TEMP/counts"' EXIT
pnpm() {
  [[ "$*" == 'exec firebase functions:list --project santas-workshop-test --json' ]] || return 2
  ((list_attempts += 1))
  if ((list_attempts <= LIST_FAILURES)); then return 1; fi
  printf '{}'
}
node() {
  [[ "$1" == 'scripts/verify-functions-parity.cjs' && "$2" == "$RUNNER_TEMP/functions.json" ]] || return 2
  ((parity_attempts += 1))
  if ((parity_attempts <= PARITY_FAILURES)); then return 1; fi
}
sleep() {
  [[ "$1" == 10 ]] || return 2
  ((sleep_count += 1))
}
${step.run}`,
					],
					{
						cwd: directory,
						env: {
							PATH: process.env['PATH'],
							SystemRoot: process.env['SystemRoot'],
							RUNNER_TEMP: directory.replaceAll('\\', '/'),
							LIST_FAILURES: String(scenario.listFailures),
							PARITY_FAILURES: String(scenario.parityFailures),
						},
						stdio: 'pipe',
					},
				);
			} catch (error) {
				status = error.status;
			}
			assert.equal(status, scenario.status, JSON.stringify(scenario));
			assert.equal(
				readFileSync(join(directory, 'counts'), 'utf8'),
				scenario.counts,
				JSON.stringify(scenario),
			);
		}
	} finally {
		assert.ok(
			directory.startsWith(
				join(tmpdir(), 'santashop-functions-inventory-'),
			),
		);
		rmSync(directory, { recursive: true, force: true });
	}
});

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

// Exercise the real workflow predicates with selected, omitted, and failed jobs.
function syntheticNeeds(paths) {
	const selection = selectChanges(paths);
	const outputs = changeOutputs(selection);
	return {
		targets: { result: 'success', outputs },
		...Object.fromEntries(
			['tooling', 'shared', 'ui', 'functions', 'e2e'].map((key) => [
				key,
				{ result: outputs[key] === 'true' ? 'success' : 'skipped' },
			]),
		),
	};
}
function browsersAllowed(needs, cancelled = false) {
	return Function(
		'needs',
		'always',
		'cancelled',
		`return (${pr.jobs.e2e.if})`,
	)(
		needs,
		() => true,
		() => cancelled,
	);
}
for (const [name, paths] of [
	['app', ['santashop-app/src/main.ts']],
	['admin', ['santashop-admin/src/main.ts']],
	['backend', ['santashop-functions/src/index.ts']],
	['app browser only', ['santashop-e2e/tests/public/signup.spec.ts']],
	['rules', ['firestore.rules']],
])
	test(`${name} starts only its selected browsers and accepts intentional skips`, () => {
		const needs = syntheticNeeds(paths);
		assert.equal(browsersAllowed(needs), true);
		assert.doesNotThrow(() => requireSelectedChecks(needs));
		assert.equal(browsersAllowed(needs, true), false);
		for (const job of ['targets', 'ui', 'shared', 'functions', 'tooling']) {
			const failed = structuredClone(needs);
			failed[job].result = 'failure';
			assert.equal(browsersAllowed(failed), false, job);
			assert.throws(() => requireSelectedChecks(failed), undefined, job);
		}
	});
for (const paths of [
	[],
	['README.md'],
	['santashop-app/src/main.spec.ts'],
	['santashop-app/src/main.stories.ts'],
	['scripts/ci-changes.mjs'],
])
	test(`no unselected browsers: ${paths}`, () => {
		const needs = syntheticNeeds(paths);
		assert.equal(browsersAllowed(needs), false);
		assert.doesNotThrow(() => requireSelectedChecks(needs));
	});
test('selected checks cannot be silently skipped or cancelled', () => {
	for (const job of ['tooling', 'shared', 'ui', 'functions', 'e2e'])
		for (const result of ['skipped', 'failure', 'cancelled']) {
			const needs = syntheticNeeds([
				'unknown.mjs',
				'scripts/ci-changes.mjs',
			]);
			needs[job].result = result;
			assert.throws(() => requireSelectedChecks(needs));
		}
});
test('selection failures and missing outputs fail the final check', () => {
	assert.throws(() => requireSelectedChecks({}));
	const needs = syntheticNeeds([]);
	delete needs.targets.outputs.ui;
	assert.throws(() => requireSelectedChecks(needs));
});
test('PR workflow always reports its required aggregate, even for documentation', () => {
	assert.equal(pr.on.pull_request, null);
	assert.equal(pr.jobs.build_validation.if, 'always()');
	assert.deepEqual(pr.jobs.build_validation.needs, [
		'targets',
		'tooling',
		'shared',
		'ui',
		'functions',
		'e2e',
	]);
	assert.equal(
		pr.jobs.build_validation.steps.at(-1).run,
		'node scripts/ci-results.mjs',
	);
	for (const key of ['ui', 'e2e'])
		assert.equal(
			pr.jobs[key].strategy.matrix,
			'${{ fromJSON(needs.targets.outputs.' + key + '_matrix) }}',
		);
	assert.equal(
		Object.values(pr.jobs).filter((job) =>
			job.uses?.endsWith('/e2e-target.yml'),
		).length,
		1,
	);
	assert.deepEqual(Object.keys(functions.on), ['workflow_call']);
});
test('browser tests use isolated runners without deployment credentials', () => {
	assert.deepEqual(release.jobs.e2e.strategy.matrix.target, ['app', 'admin']);
	assert.equal(browser.jobs.test['runs-on'], 'ubuntu-latest');
	assert.equal(browser.on.workflow_call.secrets, undefined);
	assert.equal(pr.jobs.e2e.secrets, undefined);
	assert.equal(release.jobs.e2e.secrets, undefined);
});
test('storybook behavior and visual jobs consume the same selected target matrix', () => {
	const workflow = readWorkflow('storybook-pr-validation');
	for (const name of ['storybook_behavior', 'storybook_visual']) {
		const job = workflow.jobs[name];
		assert.equal(job.env.STORYBOOK_TARGETS, '${{ matrix.target }}');
		assert.match(job.strategy.matrix, /storybook_matrix/);
		assert.match(job.if, /needs.changes.outputs.storybook == 'true'/);
	}
});
