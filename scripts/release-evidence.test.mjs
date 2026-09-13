import assert from 'node:assert/strict';
import test from 'node:test';
import {
	fixture,
	releaseSha,
	workflowSha,
	repository,
} from './release-fixtures.mjs';
import { githubApi, requirements, verifyRelease } from './release-evidence.mjs';

for (const unit of ['app', 'admin', 'functions']) {
	test(`${unit}: automatically discovers exact checkout evidence despite different dispatch metadata SHA`, async () => {
		const { options, api } = fixture(unit);
		const result = await verifyRelease(options, api);
		assert.equal(result.sha, releaseSha);
		assert.ok(result.verified.length >= 3);
		assert.equal(result.reuse, true);
		assert.equal(result.approval, 'joelmeaders');
	});
}

for (const releaseRef of [
	'v2026.09.0-beta.4',
	'master',
	'refs/tags/release-2026',
	releaseSha.slice(0, 12),
])
	test(`resolves ${releaseRef} once and verifies the immutable result`, async () => {
		const f = fixture();
		let resolutions = 0;
		const result = await verifyRelease(
			{ ...f.options, releaseRef },
			async (path) => {
				if (path === `commits/${encodeURIComponent(releaseRef)}`) {
					resolutions++;
					return {
						sha: resolutions === 1 ? releaseSha : workflowSha,
					};
				}
				return f.api(path);
			},
		);
		assert.equal(resolutions, 1);
		assert.equal(result.sha, releaseSha);
	});

for (const [name, change, pattern] of [
	[
		'wrong checkout SHA',
		(f) => {
			f.jobs.get(101)[0].steps[0].name =
				`Release revision ${workflowSha}`;
		},
		/exact-SHA/,
	],
	[
		'wrong repository',
		(f) => {
			f.runs[0].repository.full_name = 'other/repo';
		},
		/exact-SHA/,
	],
	[
		'fork head repository',
		(f) => {
			f.runs[0].head_repository.full_name = 'other/repo';
		},
		/exact-SHA/,
	],
	[
		'wrong workflow',
		(f) => {
			f.runs[0].path = '.github/workflows/functions-pr-validation.yml';
		},
		/exact-SHA/,
	],
	[
		'wrong deployment target',
		(f) => {
			f.jobs
				.get(101)
				.find(({ name }) => name === 'deploy_test').steps[1].name =
				'Test deployment functions santas-workshop-193b5';
		},
		/exact-SHA/,
	],
	[
		'PR revision',
		(f) => {
			f.runs[0].event = 'pull_request';
		},
		/exact-SHA/,
	],
	[
		'non-master workflow',
		(f) => {
			f.runs[0].head_branch = 'feature';
		},
		/exact-SHA/,
	],
	[
		'green run with skipped required test',
		(f) => {
			f.jobs.get(101)[0].steps[1].conclusion = 'skipped';
		},
		/exact-SHA/,
	],
	[
		'failed required test',
		(f) => {
			f.jobs.get(101)[0].steps[1].conclusion = 'failure';
		},
		/exact-SHA/,
	],
	[
		'failed run',
		(f) => {
			f.runs[0].conclusion = 'failure';
		},
		/exact-SHA/,
	],
	[
		'cancelled run',
		(f) => {
			f.runs[0].conclusion = 'cancelled';
		},
		/exact-SHA/,
	],
	[
		'in-progress run',
		(f) => {
			f.runs[0].status = 'in_progress';
		},
		/exact-SHA/,
	],
	[
		'missing required job',
		(f) => {
			f.jobs.get(101).shift();
		},
		/exact-SHA/,
	],
	[
		'duplicate required job',
		(f) => {
			f.jobs.get(101).push(f.jobs.get(101)[0]);
		},
		/exact-SHA/,
	],
	[
		'duplicate revision marker',
		(f) => {
			f.jobs.get(101)[0].steps.push(f.jobs.get(101)[0].steps[0]);
		},
		/exact-SHA/,
	],
	[
		'missing revision marker',
		(f) => {
			f.jobs.get(101)[0].steps.shift();
		},
		/exact-SHA/,
	],
	[
		'candidate verifier source',
		(f) => {
			f.options.workflowRef = f.options.workflowRef.replace(
				'master',
				'feature',
			);
		},
		/from master/,
	],
	[
		'missing evidence',
		(f) => {
			f.runs.length = 0;
		},
		/Run the missing test or Storybook workflow/,
	],
	[
		'non-owner production invocation',
		(f) => {
			f.options.actor = 'another-developer';
		},
		/owner/,
	],
])
	test(`rejects ${name}`, async () => {
		const f = fixture();
		change(f);
		await assert.rejects(verifyRelease(f.options, f.api), pattern);
	});

for (const releaseRef of ['', ' master', 'master\n', undefined, 123])
	test(`rejects invalid release selection ${JSON.stringify(releaseRef)}`, async () => {
		await assert.rejects(
			verifyRelease({ ...fixture().options, releaseRef }, async () => {
				throw new Error('Invalid selections must not reach the API');
			}),
			/Select a release/,
		);
	});

for (const sha of ['', 'not-a-commit', workflowSha])
	test(`rejects invalid commit resolution ${sha}`, async () => {
		const f = fixture();
		await assert.rejects(
			verifyRelease(f.options, async (path) =>
				path.startsWith('commits/') ? { sha } : f.api(path),
			),
			/immutable commit/,
		);
	});

test('rejects altered producer source even with matching workflow identity', async () => {
	const f = fixture();
	await assert.rejects(
		verifyRelease(f.options, async (path) =>
			path.startsWith('contents/')
				? {
						encoding: 'base64',
						content:
							Buffer.from('unchecked producer').toString(
								'base64',
							),
					}
				: f.api(path),
		),
		/different evidence producer/,
	);
});

test('rejects an altered reusable browser evidence producer', async () => {
	const f = fixture();
	await assert.rejects(
		verifyRelease(f.options, async (path) =>
			path.startsWith('contents/.github/workflows/e2e-target.yml?')
				? {
						encoding: 'base64',
						content: Buffer.from('unchecked E2E workflow').toString(
							'base64',
						),
					}
				: f.api(path),
		),
		/different evidence producer/,
	);
});

for (const unit of ['app', 'admin', 'functions'])
	for (const source of [
		'.github/workflows/ci-changes.yml',
		'scripts/ci-changes.mjs',
		'scripts/ci-config-impact.mjs',
		'scripts/ui-targets.mjs',
	])
		test(`${unit} rejects an altered change selection producer ${source}`, async () => {
			const f = fixture(unit);
			await assert.rejects(
				verifyRelease(f.options, async (path) =>
					path.startsWith(`contents/${source}?`)
						? {
								encoding: 'base64',
								content: Buffer.from(
									'unchecked change selector',
								).toString('base64'),
							}
						: f.api(path),
				),
				/different evidence producer/,
			);
		});

test('rejects workflow ID lookup mismatch', async () => {
	const f = fixture();
	await assert.rejects(
		verifyRelease(f.options, async (path) =>
			/^actions\/workflows\/\d+$/.test(path)
				? { id: 999, path: f.runs[0].path }
				: f.api(path),
		),
		/workflow identity/,
	);
});

test('rejects commit outside master ancestry', async () => {
	const f = fixture();
	await assert.rejects(
		verifyRelease(f.options, async (path) =>
			path.startsWith('compare/') ? { status: 'diverged' } : f.api(path),
		),
		/ancestor/,
	);
});

for (const target of ['app', 'admin']) {
	for (const outcome of ['skipped', 'failure', 'cancelled'])
		test(`rejects ${target} E2E ${outcome} in an otherwise green release`, async () => {
			const f = fixture();
			f.jobs
				.get(101)
				.find(
					({ name }) => name === `e2e (${target}) / test`,
				).steps[1].conclusion = outcome;
			await assert.rejects(verifyRelease(f.options, f.api), /exact-SHA/);
		});
	test(`rejects missing ${target} E2E evidence`, async () => {
		const f = fixture();
		f.jobs.set(
			101,
			f.jobs
				.get(101)
				.filter(({ name }) => name !== `e2e (${target}) / test`),
		);
		await assert.rejects(verifyRelease(f.options, f.api), /exact-SHA/);
	});
	test(`rejects ${target} E2E evidence from another checkout`, async () => {
		const f = fixture();
		f.jobs
			.get(101)
			.find(
				({ name }) => name === `e2e (${target}) / test`,
			).steps[0].name = `Release revision ${workflowSha}`;
		await assert.rejects(verifyRelease(f.options, f.api), /exact-SHA/);
	});
}

test('fresh test release requires new suites without evidence discovery', async () => {
	const f = fixture();
	const result = await verifyRelease(
		{ ...f.options, mode: 'test' },
		async (path) => {
			assert.ok(!path.startsWith('actions/'));
			return f.api(path);
		},
	);
	assert.equal(result.verified.length, 0);
	assert.equal(result.reuse, false);
});

for (const target of ['app', 'admin']) {
	const otherTarget = target === 'app' ? 'admin' : 'app';
	test(`${target} hosting promotion needs only its own UI and Storybook evidence`, async () => {
		const f = fixture(target);
		assert.deepEqual(
			f.runs.map(({ path }) => path),
			[
				`.github/workflows/${target}-test-and-prod-release.yml`,
				'.github/workflows/storybook-pr-validation.yml',
			],
		);
		const result = await verifyRelease(f.options, f.api);
		assert.equal(result.verified.length, 3);
		assert.deepEqual(requirements(target, true), [
			{
				path: `.github/workflows/${target}-test-and-prod-release.yml`,
				job: 'release / validate_release',
				steps: [
					'Customer or staff E2E tests',
					'Run target unit tests with prepared shared libraries',
				],
			},
			{
				path: '.github/workflows/storybook-pr-validation.yml',
				job: `storybook_behavior (${target})`,
				steps: ['Storybook behavior tests'],
			},
			{
				path: `.github/workflows/${target}-test-and-prod-release.yml`,
				job: 'release / validate_release',
				steps: [`Test deployment ${target} santas-workshop-test`],
			},
		]);
	});
	for (const outcome of [
		'missing',
		'skipped',
		'failure',
		'wrong target',
		'wrong checkout',
	])
		test(`${target} hosting rejects Storybook evidence: ${outcome}`, async () => {
			const f = fixture(target);
			const storybookRun = f.runs.find(({ path }) =>
				path.endsWith('storybook-pr-validation.yml'),
			);
			const [job] = f.jobs.get(storybookRun.id);
			if (outcome === 'missing') f.jobs.set(storybookRun.id, []);
			else if (outcome === 'wrong target')
				job.name = `storybook_behavior (${otherTarget})`;
			else if (outcome === 'wrong checkout')
				job.steps[0].name = `Release revision ${workflowSha}`;
			else job.steps[1].conclusion = outcome;
			await assert.rejects(verifyRelease(f.options, f.api), /exact-SHA/);
		});
}

test('discovers evidence on later pages without filtering by dispatch head SHA', async () => {
	const f = fixture();
	const pages = [];
	const result = await verifyRelease(f.options, async (path) => {
		if (path.includes('/runs?')) {
			assert.ok(!path.includes('head_sha'));
			pages.push(path);
			return {
				workflow_runs: path.endsWith('page=1')
					? Array.from({ length: 100 }, (_, index) => ({
							...f.runs[0],
							id: 1000 + index,
							event: 'push',
							head_sha: workflowSha,
						}))
					: f.runs,
			};
		}
		return f.api(path);
	});
	assert.equal(pages.length, 2);
	assert.equal(result.reuse, true);
});

test('ignores unrelated successful dispatches and finds the matching release', async () => {
	const f = fixture();
	f.runs.unshift({ ...structuredClone(f.runs[0]), id: 102 });
	f.jobs.set(
		102,
		structuredClone(f.jobs.get(101)).map((job) => ({
			...job,
			steps: job.steps.map((step) =>
				step.name.startsWith('Release revision ')
					? { ...step, name: `Release revision ${workflowSha}` }
					: step,
			),
		})),
	);
	const result = await verifyRelease(f.options, f.api);
	assert.ok(result.verified.every(({ runId }) => runId === 101));
});

test('a rerun that starts during verification blocks promotion', async () => {
	const f = fixture();
	let reads = 0;
	await assert.rejects(
		verifyRelease(f.options, async (path) => {
			if (path === 'actions/runs/101' && ++reads > 1)
				return { ...f.runs[0], status: 'in_progress', run_attempt: 2 };
			return f.api(path);
		}),
		/changed during verification/,
	);
});

test('malformed discovery results fail closed', async () => {
	const f = fixture();
	await assert.rejects(
		verifyRelease(f.options, async (path) =>
			path.includes('/runs?') ? {} : f.api(path),
		),
		/invalid workflow run list/,
	);
});

for (const status of [403, 404, 429, 500])
	test(`GitHub API HTTP ${status} fails closed`, async () => {
		const api = githubApi('synthetic-token', repository, async () => ({
			ok: false,
			status,
		}));
		await assert.rejects(
			verifyRelease(fixture().options, api),
			new RegExp(`HTTP ${status}`),
		);
	});

test('GitHub network error fails closed', async () => {
	const api = githubApi('synthetic-token', repository, async () => {
		throw new Error('connection reset');
	});
	await assert.rejects(verifyRelease(fixture().options, api), /connectivity/);
});
