import assert from 'node:assert/strict';
import test from 'node:test';
import {
	fixture,
	releaseSha,
	workflowSha,
	repository,
} from './release-fixtures.mjs';
import { githubApi, verifyRelease } from './release-evidence.mjs';

for (const unit of ['app', 'admin', 'functions']) {
	test(`${unit}: accepts exact checkout SHA despite different dispatch metadata SHA`, async () => {
		const { options, api } = fixture(unit);
		const result = await verifyRelease(options, api);
		assert.equal(result.sha, releaseSha);
		assert.ok(result.verified.length >= 3);
		assert.equal(result.reuse, true);
	});
}

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
		/trusted release run/,
	],
	[
		'fork head repository',
		(f) => {
			f.runs[0].head_repository.full_name = 'other/repo';
		},
		/trusted release run/,
	],
	[
		'wrong workflow',
		(f) => {
			f.runs[0].path = '.github/workflows/functions-pr-validation.yml';
		},
		/trusted release run/,
	],
	[
		'wrong deployment target',
		(f) => {
			f.jobs.get(101)[2].steps[1].name =
				'Test deployment functions santas-workshop-193b5';
		},
		/exact-SHA/,
	],
	[
		'PR revision',
		(f) => {
			f.runs[0].event = 'pull_request';
		},
		/trusted release run/,
	],
	[
		'non-master workflow',
		(f) => {
			f.runs[0].head_branch = 'feature';
		},
		/trusted release run/,
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
		'cancelled run',
		(f) => {
			f.runs[0].conclusion = 'cancelled';
		},
		/trusted release run/,
	],
	[
		'in-progress run',
		(f) => {
			f.runs[0].status = 'in_progress';
		},
		/trusted release run/,
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
		'mutable branch ref',
		(f) => {
			f.options.sha = 'master';
		},
		/full lowercase/,
	],
	[
		'abbreviated SHA',
		(f) => {
			f.options.sha = releaseSha.slice(0, 12);
		},
		/full lowercase/,
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
		'missing evidence with skip_tests',
		(f) => {
			f.options.runIds = '';
		},
		/Missing evidence/,
	],
	[
		'non-owner approval',
		(f) => {
			f.options.actor = 'another-developer';
		},
		/owner/,
	],
	[
		'approval for different SHA',
		(f) => {
			f.options.approval = workflowSha;
		},
		/owner/,
	],
])
	test(`rejects ${name}`, async () => {
		const f = fixture();
		change(f);
		await assert.rejects(verifyRelease(f.options, f.api), pattern);
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

test('rejects workflow ID lookup mismatch', async () => {
	const f = fixture();
	await assert.rejects(
		verifyRelease(f.options, async (path) =>
			path.startsWith('actions/workflows/')
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

test('test deployment reuse requires tests but does not require an earlier deployment', async () => {
	const f = fixture();
	f.options.mode = 'test';
	f.jobs.get(101).pop();
	assert.equal((await verifyRelease(f.options, f.api)).verified.length, 2);
});

test('fresh test release schedules validation without prior evidence', async () => {
	const f = fixture();
	f.options = { ...f.options, mode: 'test', skipTests: false, runIds: '' };
	assert.equal((await verifyRelease(f.options, f.api)).verified.length, 0);
});

test('shared hosting policy cannot omit the other UI or canonical Storybook checks', async () => {
	const f = fixture('app');
	f.options.runIds = '101';
	await assert.rejects(verifyRelease(f.options, f.api), /exact-SHA/);
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
