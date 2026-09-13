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
	};
	const github = {
		event_name: event.name,
		sha: event.name === 'push' ? releaseSha : workflowSha,
		workflow_sha: workflowSha,
		workflow_ref: `${repository}/.github/workflows/${unit}-test-and-prod-release.yml@refs/heads/master`,
		triggering_actor: 'joelmeaders',
		repository,
		run_id: 900,
		token: 'read-only-fixture',
		event: {},
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
			cancelled: () => false,
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
				Object.entries(workflow.on?.workflow_call?.inputs ?? {}).map(
					([key, value]) => [key, value.default],
				),
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
				mapValues(job.secrets, context);
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
					if (step.run && failCommand(step, env, `${prefix}${id}`))
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

								repository,
								workflowRef: env.RELEASE_WORKFLOW_REF,
								actor: env.RELEASE_ACTOR,
							},
							api,
						);
						context.steps[step.id] = {
							outputs: {
								sha: result.sha,
								reuse_tests: String(result.reuse),
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
						trace.deployments.push({ target, output });
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

for (const unit of ['app', 'admin', 'functions']) {
	const selected = (f, overrides = {}) => ({
		deployment_target: 'prod',
		release_ref: releaseSha,

		load_test_mode: false,
		...overrides,
	});
	for (const [name, invalidate] of [
		[
			'missing evidence',
			(f) => {
				f.runs.length = 0;
			},
		],
		[
			'skipped tests',
			(f) => {
				f.jobs.get(101)[0].steps[1].conclusion = 'skipped';
			},
		],
		[
			'wrong checkout SHA',
			(f) => {
				f.jobs.get(101)[0].steps[0].name =
					`Release revision ${workflowSha}`;
			},
		],
		[
			'API failure',
			(f) => {
				f.api = async () => {
					throw new Error('GitHub API unavailable');
				};
			},
		],
	])
		test(`${unit} workflow: ${name} blocks all production execution without manually supplied evidence`, async () => {
			const f = fixture(unit);
			invalidate(f);
			const trace = await dryRun(unit, selected(f), f.api);
			assert.ok(trace.errors.length);
			assert.deepEqual(trace.deployments, []);
			assert.deepEqual(trace.productionSecrets, []);
			assert.deepEqual(
				trace.checkouts.map(({ ref }) => ref),
				[workflowSha],
			);
		});
	test(`${unit} workflow: automatic verified reuse reaches sentinel with immutable SHA and no suite rerun`, async () => {
		const f = fixture(unit);
		const trace = await dryRun(unit, selected(f), f.api);
		assert.deepEqual(trace.errors, []);
		assert.deepEqual(trace.deployments, [
			{ target: 'santas-workshop-193b5', output: 'deployment-sentinel' },
		]);
		assert.ok(trace.productionSecrets.length);
		assert.ok(
			trace.checkouts
				.filter(({ job }) => !job.includes('verify'))
				.every(({ ref }) => ref === releaseSha),
		);
		assert.equal(
			trace.commands.filter(({ run }) =>
				/functions:test:|e2e:test:|ci:core:test|\" test$/.test(run),
			).length,
			0,
		);
	});
	test(`${unit} workflow: fresh test release runs required suites before test sentinel`, async () => {
		const f = fixture(unit);
		const trace = await dryRun(
			unit,
			selected(f, {
				deployment_target: 'test',
			}),
			f.api,
		);
		assert.deepEqual(trace.errors, []);
		assert.deepEqual(trace.deployments, [
			{ target: 'santas-workshop-test', output: 'deployment-sentinel' },
		]);
		const commands = trace.commands.map(({ run }) => run);
		assert.ok(
			commands.some((run) =>
				run.includes(
					unit === 'functions'
						? 'functions:test:integration'
						: 'ci:core:test',
				),
			),
		);
		assert.ok(commands.some((run) => run.includes('e2e:test')));
	});
}

for (const [name, paths, deployments] of [
	['customer source', ['santashop-app/src/app/app.component.ts'], ['app']],
	['admin source', ['santashop-admin/src/app/app.component.ts'], ['admin']],
	['backend source', ['santashop-functions/src/index.ts'], ['functions']],
	['customer unit test', ['santashop-app/src/app/app.component.spec.ts'], []],
	[
		'customer browser test',
		['santashop-e2e/tests/public/signup.spec.ts'],
		[],
	],
	['documentation', ['docs/release-readiness.md'], []],
])
	for (const unit of ['app', 'admin', 'functions'])
		test(`${unit} push deploys only when selected by ${name}`, async () => {
			const f = fixture(unit);
			const trace = await dryRun(
				unit,
				{},
				f.api,
				() => {},
				() => false,
				{ name: 'push', paths },
			);
			assert.deepEqual(trace.errors, []);
			if (!deployments.includes(unit))
				assert.deepEqual(trace.productionSecrets, []);
			assert.equal(
				trace.deployments.length,
				deployments.includes(unit) ? 1 : 0,
			);
			if (trace.deployments.length)
				assert.equal(
					trace.deployments[0].target,
					'santas-workshop-test',
				);
		});

for (const unit of ['app', 'admin', 'functions'])
	test(`${unit} push blocks deployment when change detection fails`, async () => {
		const f = fixture(unit);
		const trace = await dryRun(
			unit,
			{},
			f.api,
			() => {},
			(step) => step.run === 'node scripts/ci-changes.mjs',
			{ name: 'push', paths: [`santashop-${unit}/src/index.ts`] },
		);
		assert.ok(
			trace.errors.some((error) => error.includes('ci-changes.mjs')),
		);
		assert.deepEqual(trace.deployments, []);
		assert.deepEqual(trace.productionSecrets, []);
	});

test('rules-only deployment cannot certify that Functions were deployed', async () => {
	const f = fixture();
	const trace = await dryRun(
		'functions',
		{},
		f.api,
		() => {},
		() => false,
		{ name: 'push', paths: ['firestore.rules'] },
	);
	assert.deepEqual(trace.errors, []);
	assert.equal(trace.deployments.length, 1);
	assert.ok(
		!trace.commands.some(
			({ name }) =>
				name === 'Test deployment functions santas-workshop-test',
		),
	);
});

test('workflow mutation witness: removing production dependency reaches sentinel after rejected evidence', async () => {
	const f = fixture();
	f.runs.length = 0;
	const trace = await dryRun(
		'functions',
		{
			deployment_target: 'prod',
			release_ref: releaseSha,

			load_test_mode: false,
		},
		f.api,
		(path, workflow) => {
			if (path.endsWith('functions-test-and-prod-release.yml')) {
				// Reintroduce the former independent production job and input checkout.
				workflow.jobs.deploy_prod = JSON.parse(
					JSON.stringify(workflow.jobs.deploy_prod).replaceAll(
						'needs.prepare_release.outputs.sha',
						'inputs.release_ref',
					),
				);
				delete workflow.jobs.deploy_prod.needs;
				workflow.jobs.deploy_prod.if =
					"github.event_name == 'workflow_dispatch' && inputs.deployment_target == 'prod'";
			}
		},
	);
	assert.ok(trace.errors.length);
	assert.ok(
		trace.productionSecrets.length,
		'The harness detects production access if the real dependency is removed',
	);
	assert.deepEqual(trace.deployments, [
		{ target: 'santas-workshop-193b5', output: 'deployment-sentinel' },
	]);
});

for (const unit of ['app', 'admin', 'functions']) {
	test(`${unit} dispatch needs no manual evidence or repeated approval fields`, () => {
		const workflow = readWorkflow(
			`.github/workflows/${unit}-test-and-prod-release.yml`,
		);
		assert.deepEqual(
			Object.keys(workflow.on.workflow_dispatch.inputs).sort(),
			(unit === 'functions'
				? ['deployment_target', 'load_test_mode', 'release_ref']
				: ['deployment_target', 'release_ref']
			).sort(),
		);
	});
	test(`${unit} selected tag is resolved before any candidate checkout`, async () => {
		const f = fixture(unit);
		const trace = await dryRun(
			unit,
			{ deployment_target: 'prod', release_ref: 'release/2026.09' },
			async (path) =>
				path === 'commits/release%2F2026.09'
					? { sha: releaseSha }
					: f.api(path),
		);
		assert.deepEqual(trace.errors, []);
		assert.ok(
			trace.checkouts
				.filter(({ job }) => !job.includes('verify'))
				.every(({ ref }) => ref === releaseSha),
		);
		assert.equal(trace.deployments.length, 1);
	});
}

for (const target of ['app', 'admin'])
	test(`Functions test deployment is blocked when ${target} E2E fails`, async () => {
		const f = fixture();
		const trace = await dryRun(
			'functions',
			{
				deployment_target: 'test',
				release_ref: releaseSha,
			},
			f.api,
			() => {},
			(step, env) =>
				step.name === 'Customer or staff E2E tests' &&
				env.E2E_TARGET === target,
		);
		assert.ok(
			trace.errors.some((error) =>
				error.includes('Customer or staff E2E tests'),
			),
		);
		assert.deepEqual(trace.deployments, []);
	});

test('Functions test deployment is blocked when the browser matrix is skipped', async () => {
	const f = fixture();
	const trace = await dryRun(
		'functions',
		{
			deployment_target: 'test',
			release_ref: releaseSha,
		},
		f.api,
		(path, workflow) => {
			if (path.endsWith('functions-test-and-prod-release.yml'))
				workflow.jobs.e2e.if = 'false';
		},
	);
	assert.deepEqual(trace.errors, []);
	assert.deepEqual(trace.deployments, []);
});

for (const target of ['app', 'admin'])
	test(`${target} release runs unit and build checks before E2E`, async () => {
		const f = fixture(target);
		const trace = await dryRun(
			target,
			{
				deployment_target: 'test',
				release_ref: releaseSha,
			},
			f.api,
		);
		assert.deepEqual(trace.errors, []);
		const e2e = trace.commands.findIndex(
			({ name }) => name === 'Customer or staff E2E tests',
		);
		const unit = trace.commands.findIndex(
			({ name }) =>
				name === 'Run target unit tests with prepared shared libraries',
		);
		const build = trace.commands.findIndex(
			({ run }) => run === 'pnpm run "ci:$UI_TARGET:build:$UI_MODE"',
		);
		assert.ok(unit >= 0 && unit < build && build < e2e);
	});
