import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
	fixture,
	releaseSha,
	repository,
	workflowSha,
} from './release-fixtures.mjs';
import { verifyRelease } from './release-evidence.mjs';
import { changeOutputs } from './ci-changes.mjs';
import { selectChanges } from './ui-targets.mjs';

// Use the repository's existing ESLint YAML parser; no new runtime or package.
const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint'))('js-yaml');
const readWorkflow = (path) => load(readFileSync(path, 'utf8'));

// A bounded dry run of these real YAML files. Evaluate their inputs, needs,
// status conditions, reusable workflows, and step environments. Run the real
// verifier. Replace external actions/build/deploy commands with trace entries
// and a harmless child-process sentinel. Never pass process.env or credentials.
async function dryRun(
	unit,
	inputs,
	api,
	mutate = () => {},
	failCommand = () => false,
	event = { name: 'workflow_dispatch', paths: [] },
) {
	const trace = {
		commands: [],
		deployments: [],
		productionSecrets: [],
		checkouts: [],
		errors: [],
		pendingApprovals: [],
		jobs: {},
	};
	const github = {
		event_name: event.name,
		sha: event.name === 'push' ? releaseSha : workflowSha,
		workflow_sha: workflowSha,
		workflow_ref: `${repository}/.github/workflows/${unit}-test-and-prod-release.yml@refs/heads/master`,
		triggering_actor: event.actor ?? 'joelmeaders',
		repository,
		run_id: 900,
		token: 'read-only-fixture',
		event: { head_commit: { message: event.message ?? '' } },
	};
	const secrets = new Proxy(
		{},
		{
			get: (_, key) => {
				if (/PROD|193B5/.test(key)) trace.productionSecrets.push(key);
				return 'unusable-sentinel';
			},
		},
	);
	function evaluate(value, context) {
		if (typeof value !== 'string') return value;
		const expression = (source) =>
			Function(
				...Object.keys(context),
				`return (${source});`,
			)(...Object.values(context));
		const full = value.match(/^\$\{\{\s*([\s\S]*?)\s*\}\}$/);
		if (full) return expression(full[1]);
		return value.replace(/\$\{\{\s*([\s\S]*?)\s*\}\}/g, (_, source) =>
			expression(source),
		);
	}
	function mapValues(values, context) {
		return Object.fromEntries(
			Object.entries(values ?? {}).map(([key, value]) => [
				key,
				evaluate(value, context),
			]),
		);
	}
	function contextFor(values, successful) {
		return {
			github,
			secrets,
			vars: {},
			...values,
			always: () => true,
			cancelled: () => event.cancelled === true,
			contains: (value, part) =>
				String(value ?? '')
					.toLowerCase()
					.includes(part.toLowerCase()),
			failure: () => !successful,
			success: () => successful,
			format: (format, ...args) =>
				format.replace(/\{(\d+)\}/g, (_, index) => args[index]),
		};
	}
	function permitted(condition, context, success) {
		if (!condition) return success;
		if (
			!/always\(|cancelled\(|failure\(|success\(/.test(condition) &&
			!success
		)
			return false;
		return Boolean(
			evaluate(
				condition.startsWith('${{')
					? condition
					: `\${{ ${condition} }}`,
				context,
			),
		);
	}
	async function run(path, passedInputs, prefix = '') {
		const workflow = readWorkflow(path);
		mutate(path, workflow);
		const inputs = {
			...Object.fromEntries(
				Object.entries(
					workflow.on?.workflow_call?.inputs ??
						workflow.on?.workflow_dispatch?.inputs ??
						{},
				).map(([key, value]) => [key, value.default]),
			),
			...passedInputs,
		};
		const results = {};
		// GitHub's implicit success() includes skipped transitive dependencies.
		// A successful release gate does not erase its skipped changes ancestor.
		const ancestors = (job) =>
			[job.needs ?? []]
				.flat()
				.flatMap((name) => [name, ...ancestors(workflow.jobs[name])]);
		for (const [id, job] of Object.entries(workflow.jobs)) {
			const needs = Object.fromEntries(
				[job.needs ?? []].flat().map((name) => {
					assert.ok(
						results[name],
						`Unsupported forward dependency ${name}`,
					);
					return [name, results[name]];
				}),
			);
			let successful = ancestors(job).every(
				(name) => results[name].result === 'success',
			);
			let context = contextFor(
				{
					inputs,
					needs,
					env: {},
					steps: {},
					job: { status: 'success' },
				},
				successful,
			);
			if (!permitted(job.if, context, successful)) {
				results[id] = { result: 'skipped', outputs: {} };
				continue;
			}
			if (job.uses) {
				const branches = [];
				for (const target of job.strategy?.matrix?.target ?? [
					undefined,
				]) {
					context.matrix = { target };
					branches.push(
						await run(
							job.uses,
							mapValues(job.with, context),
							`${prefix}${id}${target ? ` (${target})` : ''} / `,
						),
					);
				}
				results[id] =
					branches.length === 1
						? branches[0]
						: {
								result: branches.every(
									({ result }) => result === 'success',
								)
									? 'success'
									: 'failure',
								outputs: {},
							};
				continue;
			}
			const environment = evaluate(
				typeof job.environment === 'string'
					? job.environment
					: job.environment?.name,
				context,
			);
			if (environment === 'production' && event.approval !== 'approved') {
				trace.pendingApprovals.push(`${prefix}${id}`);
				results[id] = { result: 'waiting', outputs: {} };
				continue;
			}
			successful = true;
			context.env = {
				...mapValues(workflow.env, context),
				...mapValues(job.env, context),
			};
			for (const step of job.steps) {
				context = {
					...context,
					...contextFor({}, successful),
					job: { status: successful ? 'success' : 'failure' },
				};
				if (!permitted(step.if, context, successful)) continue;
				const env = { ...context.env, ...mapValues(step.env, context) };
				try {
					if (failCommand(step, env, `${prefix}${id}`))
						throw new Error(
							`Command failed: ${step.name ?? step.run}`,
						);
					if (step.uses?.startsWith('actions/checkout@'))
						trace.checkouts.push({
							job: `${prefix}${id}`,
							ref: evaluate(
								step.with?.ref ?? '${{ github.sha }}',
								context,
							),
						});
					if (step.id === 'revision')
						context.steps.revision = {
							outputs: { sha: releaseSha },
						};
					if (step.run === 'node scripts/ci-changes.mjs') {
						context.steps[step.id] = {
							outputs: changeOutputs(selectChanges(event.paths)),
						};
					} else if (
						step.run === 'node scripts/release-evidence.mjs'
					) {
						const result = await verifyRelease(
							{
								releaseRef: env.RELEASE_REF,
								unit: env.RELEASE_UNIT,
								mode: env.RELEASE_MODE,
								skipTests: env.RELEASE_SKIP_TESTS,
								commitMessage: env.RELEASE_COMMIT_MESSAGE,

								repository,
								workflowRef: env.RELEASE_WORKFLOW_REF,
								actor: env.RELEASE_ACTOR,
							},
							api,
						);
						context.steps[step.id] = {
							outputs: {
								sha: result.sha,
								skip_tests: String(result.skipTests),
							},
						};
					} else if (
						step.uses?.startsWith(
							'FirebaseExtended/action-hosting-deploy@',
						) ||
						step.run?.includes('pnpm run ci:functions:deploy:')
					) {
						const target = step.with
							? evaluate(step.with.projectId, context)
							: step.run.endsWith(':prod')
								? 'santas-workshop-193b5'
								: 'santas-workshop-test';
						const output = execFileSync(
							process.execPath,
							[
								'-e',
								'process.stdout.write("deployment-sentinel")',
							],
							{ env: {}, encoding: 'utf8' },
						);
						trace.deployments.push({
							target,
							output,
							functions: env.SANTASHOP_DEPLOY_FUNCTIONS,
							rules: env.SANTASHOP_DEPLOY_RULES,
						});
					} else if (step.run)
						trace.commands.push({
							job: `${prefix}${id}`,
							name: step.name,
							run: step.run,
						});
				} catch (error) {
					successful = false;
					trace.errors.push(error.message);
				}
			}
			results[id] = {
				result: successful ? 'success' : 'failure',
				outputs: successful ? mapValues(job.outputs, context) : {},
			};
		}
		Object.assign(
			trace.jobs,
			Object.fromEntries(
				Object.entries(results).map(([id, result]) => [
					prefix + id,
					result.result,
				]),
			),
		);
		const finalContext = contextFor({ jobs: results }, true);
		return {
			result: Object.values(results).some(
				({ result }) => result === 'failure',
			)
				? 'failure'
				: 'success',
			outputs: Object.fromEntries(
				Object.entries(workflow.on?.workflow_call?.outputs ?? {}).map(
					([key, value]) => [
						key,
						evaluate(value.value, finalContext),
					],
				),
			),
		};
	}
	await run(`.github/workflows/${unit}-test-and-prod-release.yml`, inputs);
	return trace;
}

const deploymentTargets = (trace) =>
	trace.deployments.map(({ target }) => target);
const suiteCommands = (trace) =>
	trace.commands.filter(({ run }) =>
		/functions:test:|e2e:test:|ci:core:test|" test$/.test(run),
	);

for (const unit of ['app', 'admin', 'functions']) {
	const inputs = {
		release_ref: releaseSha,
		deployment_target: 'prod',
		skip_tests: false,
	};
	const push = { name: 'push', paths: [`santashop-${unit}/src/index.ts`] };
	for (const skip_tests of [false, true]) {
		test(`${unit}: TEST completes before production approval, skip_tests=${skip_tests}`, async () => {
			const f = fixture(unit);
			const trace = await dryRun(unit, { ...inputs, skip_tests }, f.api);
			assert.deepEqual(trace.errors, []);
			assert.deepEqual(deploymentTargets(trace), [
				'santas-workshop-test',
			]);
			assert.equal(trace.pendingApprovals.length, 1);
			assert.deepEqual(trace.productionSecrets, []);
			assert.equal(suiteCommands(trace).length > 0, !skip_tests);
		});
		test(`${unit}: approval deploys the same SHA after TEST, skip_tests=${skip_tests}`, async () => {
			const f = fixture(unit);
			const trace = await dryRun(
				unit,
				{ ...inputs, skip_tests },
				f.api,
				undefined,
				undefined,
				{ name: 'workflow_dispatch', paths: [], approval: 'approved' },
			);
			assert.deepEqual(trace.errors, []);
			assert.deepEqual(deploymentTargets(trace), [
				'santas-workshop-test',
				'santas-workshop-193b5',
			]);
			assert.ok(trace.productionSecrets.length);
			assert.ok(
				trace.checkouts
					.filter(({ job }) => !job.includes('verify'))
					.every(({ ref }) => ref === releaseSha),
			);
			assert.ok(
				suiteCommands(trace).every(
					({ job }) => !job.startsWith('deploy_prod'),
				),
			);
		});
	}
	for (const message of ['Ordinary fix', 'Urgent repair [skip tests]']) {
		test(`${unit}: push automatically offers production for ${message}`, async () => {
			const trace = await dryRun(
				unit,
				{},
				fixture(unit).api,
				undefined,
				undefined,
				{ ...push, message },
			);
			assert.deepEqual(trace.errors, []);
			assert.deepEqual(deploymentTargets(trace), [
				'santas-workshop-test',
			]);
			assert.equal(trace.pendingApprovals.length, 1);
			assert.equal(
				suiteCommands(trace).length > 0,
				!message.includes('[skip tests]'),
			);
		});
	}
	test(`${unit}: non-owner cannot skip suites`, async () => {
		const trace = await dryRun(
			unit,
			{},
			fixture(unit).api,
			undefined,
			undefined,
			{ ...push, message: 'Fix [skip tests]', actor: 'contributor' },
		);
		assert.ok(trace.errors.some((error) => error.includes('owner')));
		assert.deepEqual(trace.deployments, []);
		assert.deepEqual(trace.pendingApprovals, []);
	});
	for (const failure of ['test', 'build', 'deploy']) {
		test(`${unit}: ${failure} failure blocks the production approval`, async () => {
			const trace = await dryRun(
				unit,
				inputs,
				fixture(unit).api,
				undefined,
				(step) => {
					if (failure === 'test')
						return [
							'Functions unit tests',
							'Run target unit tests with prepared shared libraries',
						].includes(step.name);
					if (failure === 'build')
						return step.run === 'pnpm install --frozen-lockfile';
					return (
						step.run?.includes('ci:functions:deploy:test') ||
						step.uses?.startsWith(
							'FirebaseExtended/action-hosting-deploy@',
						)
					);
				},
			);
			assert.ok(trace.errors.length);
			assert.deepEqual(trace.pendingApprovals, []);
			assert.deepEqual(trace.productionSecrets, []);
		});
	}
	test(`${unit}: skipping TEST deployment never offers production`, async () => {
		const trace = await dryRun(
			unit,
			inputs,
			fixture(unit).api,
			(path, workflow) => {
				if (path.endsWith(`${unit}-test-and-prod-release.yml`))
					workflow.jobs[
						unit === 'functions' ? 'deploy_test' : 'release'
					].if = 'false';
			},
		);
		assert.deepEqual(trace.deployments, []);
		assert.deepEqual(trace.pendingApprovals, []);
	});
	test(`${unit}: cancellation cannot reach production`, async () => {
		const trace = await dryRun(
			unit,
			inputs,
			fixture(unit).api,
			undefined,
			undefined,
			{ ...push, cancelled: true, approval: 'approved' },
		);
		assert.deepEqual(trace.deployments, []);
		assert.deepEqual(trace.pendingApprovals, []);
	});
	test(`${unit}: API errors stop before candidate code`, async () => {
		const trace = await dryRun(unit, inputs, async () => {
			throw new Error('GitHub unavailable');
		});
		assert.ok(trace.errors.length);
		assert.deepEqual(
			trace.checkouts.map(({ ref }) => ref),
			[workflowSha],
		);
		assert.deepEqual(trace.deployments, []);
		assert.deepEqual(trace.productionSecrets, []);
	});
	test(`${unit}: explicit test-only dispatch stops after TEST`, async () => {
		const trace = await dryRun(
			unit,
			{ ...inputs, deployment_target: 'test' },
			fixture(unit).api,
		);
		assert.deepEqual(trace.errors, []);
		assert.deepEqual(deploymentTargets(trace), ['santas-workshop-test']);
		assert.deepEqual(trace.pendingApprovals, []);
	});
	test(`${unit}: rollback tag is resolved once before both deployments`, async () => {
		const f = fixture(unit);
		let resolutions = 0;
		const trace = await dryRun(
			unit,
			{ ...inputs, release_ref: 'release/old', skip_tests: true },
			async (path) => {
				if (path === 'commits/release%2Fold') {
					resolutions++;
					return { sha: releaseSha };
				}
				return f.api(path);
			},
			undefined,
			undefined,
			{ name: 'workflow_dispatch', paths: [], approval: 'approved' },
		);
		assert.deepEqual(trace.errors, []);
		assert.equal(resolutions, 1);
		assert.deepEqual(deploymentTargets(trace), [
			'santas-workshop-test',
			'santas-workshop-193b5',
		]);
		assert.ok(
			trace.checkouts
				.filter(({ job }) => !job.includes('verify'))
				.every(({ ref }) => ref === releaseSha),
		);
	});
}

for (const skipped of ['unit_tests', 'integration_tests', 'e2e'])
	test(`Functions: a skipped ${skipped} job still permits TEST and production approval`, async () => {
		const trace = await dryRun(
			'functions',
			{ release_ref: releaseSha, deployment_target: 'prod' },
			fixture().api,
			(path, workflow) => {
				if (path.endsWith('functions-test-and-prod-release.yml'))
					workflow.jobs[skipped].if = 'false';
			},
		);
		assert.deepEqual(trace.errors, []);
		assert.deepEqual(deploymentTargets(trace), ['santas-workshop-test']);
		assert.equal(trace.pendingApprovals.length, 1);
	});

for (const target of ['app', 'admin'])
	test(`Functions: failed ${target} browser tests stop TEST and production`, async () => {
		const trace = await dryRun(
			'functions',
			{ release_ref: releaseSha },
			fixture().api,
			undefined,
			(step, env) =>
				step.name === 'Customer or staff E2E tests' &&
				env.E2E_TARGET === target,
		);
		assert.ok(trace.errors.length);
		assert.deepEqual(trace.deployments, []);
		assert.deepEqual(trace.pendingApprovals, []);
	});

test('isolated Functions load testing cannot reach production', async () => {
	const trace = await dryRun(
		'functions',
		{
			release_ref: releaseSha,
			deployment_target: 'prod',
			load_test_mode: true,
			skip_tests: true,
		},
		fixture().api,
	);
	assert.deepEqual(trace.errors, []);
	assert.deepEqual(deploymentTargets(trace), ['santas-workshop-test']);
	assert.deepEqual(trace.pendingApprovals, []);
});

for (const [paths, selected] of [
	[['santashop-app/src/app/app.component.ts'], ['app']],
	[['santashop-admin/src/app/app.component.ts'], ['admin']],
	[['santashop-functions/src/index.ts'], ['functions']],
	[['firestore.rules'], ['functions']],
	[['santashop-app/src/app/app.component.spec.ts'], []],
	[['docs/release-readiness.md'], []],
])
	for (const unit of ['app', 'admin', 'functions']) {
		test(`${unit}: ${paths[0]} preserves deployment selection through production`, async () => {
			const trace = await dryRun(
				unit,
				{},
				fixture(unit).api,
				undefined,
				undefined,
				{ name: 'push', paths, approval: 'approved' },
			);
			assert.deepEqual(trace.errors, []);
			assert.deepEqual(
				deploymentTargets(trace),
				selected.includes(unit)
					? ['santas-workshop-test', 'santas-workshop-193b5']
					: [],
			);
			if (unit === 'functions' && selected.includes(unit)) {
				assert.ok(
					trace.deployments.every(({ functions, rules }) =>
						paths[0] === 'firestore.rules'
							? functions === 'false' && rules === 'true'
							: functions === 'true' && rules === 'false',
					),
				);
			}
		});
	}

test('mutation witness: removing the environment permits production without approval', async () => {
	const trace = await dryRun(
		'functions',
		{ release_ref: releaseSha, deployment_target: 'prod' },
		fixture().api,
		(path, workflow) => {
			if (path.endsWith('functions-test-and-prod-release.yml'))
				delete workflow.jobs.deploy_prod.environment;
		},
	);
	assert.deepEqual(deploymentTargets(trace), [
		'santas-workshop-test',
		'santas-workshop-193b5',
	]);
	assert.ok(trace.productionSecrets.length);
});

for (const target of ['app', 'admin'])
	test(`${target}: unit tests and build run before E2E`, async () => {
		const trace = await dryRun(
			target,
			{ release_ref: releaseSha },
			fixture(target).api,
		);
		const unit = trace.commands.findIndex(
			({ name }) =>
				name === 'Run target unit tests with prepared shared libraries',
		);
		const build = trace.commands.findIndex(
			({ run }) => run === 'pnpm run "ci:$UI_TARGET:build:$UI_MODE"',
		);
		const e2e = trace.commands.findIndex(
			({ name }) => name === 'Customer or staff E2E tests',
		);
		assert.ok(unit >= 0 && unit < build && build < e2e);
	});
