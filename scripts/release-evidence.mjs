import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workflow = (unit) =>
	`.github/workflows/${unit}-test-and-prod-release.yml`;
const storybook = '.github/workflows/storybook-pr-validation.yml';
const shaPattern = /^[0-9a-f]{40}$/;

export function requirements(unit, deploymentRequired) {
	const units = unit === 'functions' ? ['functions'] : ['app', 'admin'];
	const result = units.flatMap((target) =>
		target === 'functions'
			? [
					{
						path: workflow(target),
						job: 'unit_tests',
						steps: ['Functions unit tests'],
					},
					{
						path: workflow(target),
						job: 'integration_tests',
						steps: [
							'Functions integration tests',
							'Run customer and staff E2E tests',
						],
					},
				]
			: [
					{
						path: workflow(target),
						job: 'release / validate_release',
						steps: [
							'Customer or staff E2E tests',
							'Run shared core tests for this standalone release',
							'Run target unit tests with prepared shared libraries',
						],
					},
				],
	);
	if (unit !== 'functions')
		result.push({
			path: storybook,
			job: 'storybook_behavior',
			steps: ['Storybook behavior tests'],
		});
	if (deploymentRequired)
		result.push({
			path: workflow(unit),
			job:
				unit === 'functions'
					? 'deploy_test'
					: 'release / validate_release',
			steps: [`Test deployment ${unit} santas-workshop-test`],
		});
	return result;
}

export function githubApi(token, repository, fetchImpl = fetch) {
	if (!token)
		throw new Error('GITHUB_TOKEN is required to read release evidence.');
	return async (path) => {
		let response;
		try {
			response = await fetchImpl(
				`https://api.github.com/repos/${repository}/${path}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/vnd.github+json',
						'X-GitHub-Api-Version': '2022-11-28',
					},
					signal: AbortSignal.timeout(30_000),
				},
			);
		} catch {
			throw new Error(
				`Cannot read release evidence (${path}); check GitHub connectivity and retry.`,
			);
		}
		if (!response.ok)
			throw new Error(
				`Cannot read release evidence (${path}): HTTP ${response.status}. Check contents:read and actions:read permissions.`,
			);
		return response.json();
	};
}

export async function verifyRelease(
	options,
	api,
	readTrusted = (path) => readFileSync(path, 'utf8'),
) {
	const {
		sha,
		unit,
		mode,
		skipTests,
		repository,
		workflowRef,
		actor,
		approval,
		runIds = '',
	} = options;
	if (!shaPattern.test(sha ?? ''))
		throw new Error(
			'release_ref must be a full lowercase 40-character commit SHA; branches and tags are not accepted.',
		);
	if (
		!['app', 'admin', 'functions'].includes(unit) ||
		!['test', 'prod'].includes(mode)
	)
		throw new Error('Invalid release unit or deployment target.');
	if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? ''))
		throw new Error('Invalid repository.');
	if (workflowRef !== `${repository}/${workflow(unit)}@refs/heads/master`)
		throw new Error(
			'Run the release workflow from master; candidate workflow code cannot approve a release.',
		);
	const commit = await api(`commits/${sha}`);
	if (commit.sha !== sha)
		throw new Error(
			'The selected SHA does not resolve to the requested commit.',
		);
	const ancestry = await api(`compare/${sha}...master`);
	if (!['ahead', 'identical'].includes(ancestry.status))
		throw new Error(
			'The selected commit must be on master (an ancestor of its current tip).',
		);
	if (
		mode === 'prod' &&
		(actor !== repository.split('/')[0] || approval !== sha)
	)
		throw new Error(
			'Production approval requires the repository owner to dispatch with production_approval equal to the selected SHA.',
		);
	const required =
		mode === 'prod' || skipTests ? requirements(unit, mode === 'prod') : [];
	const ids = [
		...new Set(
			runIds
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean),
		),
	];
	if (ids.some((id) => !/^[1-9][0-9]*$/.test(id)) || ids.length > 20)
		throw new Error(
			'evidence_run_ids must contain at most 20 comma-separated GitHub Actions run IDs.',
		);
	if (required.length && !ids.length)
		throw new Error(
			'Missing evidence_run_ids. Supply successful exact-SHA validation runs and, for production, a test deployment run.',
		);
	const evidence = [];
	const allowedPaths = new Set(required.map(({ path }) => path));
	for (const id of required.length ? ids : []) {
		const run = await api(`actions/runs/${id}`);
		const path = run.path?.split('@')[0];
		if (
			String(run.id) !== id ||
			run.repository?.full_name !== repository ||
			run.head_repository?.full_name !== repository ||
			!allowedPaths.has(path) ||
			run.head_branch !== 'master' ||
			!['push', 'workflow_dispatch'].includes(run.event) ||
			run.status !== 'completed' ||
			run.conclusion !== 'success' ||
			!Number.isInteger(run.run_attempt)
		)
			throw new Error(
				`Run ${id} is not a completed successful trusted release run for this repository and target.`,
			);
		const identity = await api(`actions/workflows/${run.workflow_id}`);
		if (identity.path !== path || identity.id !== run.workflow_id)
			throw new Error(`Run ${id} has an unexpected workflow identity.`);
		// A dispatch's head_sha identifies its workflow source, not its candidate checkout.
		// Compare producer source with this trusted checkout before accepting API step names.
		const sources = [path];
		if (path !== storybook)
			sources.push(
				'.github/workflows/release-gate.yml',
				'scripts/release-evidence.mjs',
			);
		if (path === workflow('app') || path === workflow('admin'))
			sources.push('.github/workflows/ui-target.yml');
		if (!shaPattern.test(run.head_sha ?? ''))
			throw new Error(`Run ${id} has no immutable workflow source.`);
		for (const source of sources) {
			const content = await api(`contents/${source}?ref=${run.head_sha}`);
			if (
				content.encoding !== 'base64' ||
				Buffer.from(content.content ?? '', 'base64')
					.toString('utf8')
					.replaceAll('\r\n', '\n') !==
					readTrusted(source).replaceAll('\r\n', '\n')
			)
				throw new Error(
					`Run ${id} used a different evidence producer (${source}); rerun validation from current master.`,
				);
		}
		const jobs = [];
		for (let page = 1; ; page++) {
			const response = await api(
				`actions/runs/${id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`,
			);
			if (!Array.isArray(response.jobs))
				throw new Error(`Run ${id} returned invalid jobs.`);
			jobs.push(...response.jobs);
			if (response.jobs.length < 100) break;
			if (page >= 20)
				throw new Error(
					`Run ${id} has too many jobs to verify safely.`,
				);
		}
		evidence.push({
			id,
			path,
			jobs,
			url: `https://github.com/${repository}/actions/runs/${id}`,
		});
	}
	const verified = required.map((requirement) => {
		const match = evidence.find((run) => {
			const jobs = run.jobs.filter((job) => job.name === requirement.job);
			if (run.path !== requirement.path || jobs.length !== 1)
				return false;
			const [job] = jobs;
			if (
				job.status !== 'completed' ||
				job.conclusion !== 'success' ||
				!Array.isArray(job.steps)
			)
				return false;
			if (
				job.steps.filter((step) =>
					step.name.startsWith('Release revision '),
				).length !== 1
			)
				return false;
			return [`Release revision ${sha}`, ...requirement.steps].every(
				(name) => {
					const steps = job.steps.filter(
						(step) => step.name === name,
					);
					return (
						steps.length === 1 &&
						steps[0].status === 'completed' &&
						steps[0].conclusion === 'success'
					);
				},
			);
		});
		if (!match)
			throw new Error(
				`Missing successful exact-SHA evidence: ${requirement.job} / ${requirement.steps.join(', ')}. Skipped steps and PR revisions do not qualify.`,
			);
		return { checks: requirement.steps, runId: match.id, url: match.url };
	});
	return {
		sha,
		unit,
		mode,
		verified,
		approval: mode === 'prod' ? actor : null,
		reuse: skipTests,
	};
}

export function releaseSummary(result) {
	return [
		`### Verified release selection: ${result.unit}/${result.mode}`,
		`- Immutable SHA: \`${result.sha}\``,
		...result.verified.map(
			(item) =>
				`- ${item.checks.join(', ')}: [run ${item.runId}](${item.url})`,
		),
		`- Tests: ${result.verified.length ? 'successful prior evidence verified' : 'required in this test run'}; ${result.reuse ? 'reuse requested, no suite rerun' : 'normal suite execution'}.`,
		`- Approval: ${result.approval ? `owner ${result.approval} approved this SHA and the listed runs by dispatch` : 'test target; no production approval'}.`,
		'- Production deployment: not executed by this gate. The deployment job records its own result.',
		'- Emergency bypass: none.',
		'',
	].join('\n');
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const result = await verifyRelease(
			{
				sha: process.env.RELEASE_SHA,
				unit: process.env.RELEASE_UNIT,
				mode: process.env.RELEASE_MODE,
				skipTests: process.env.SKIP_TESTS === 'true',
				repository: process.env.GITHUB_REPOSITORY,
				workflowRef: process.env.RELEASE_WORKFLOW_REF,
				actor: process.env.RELEASE_ACTOR,
				approval: process.env.PRODUCTION_APPROVAL,
				runIds: process.env.EVIDENCE_RUN_IDS,
			},
			githubApi(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY),
		);
		if (process.env.GITHUB_OUTPUT)
			appendFileSync(process.env.GITHUB_OUTPUT, `sha=${result.sha}\n`);
		if (process.env.GITHUB_STEP_SUMMARY)
			appendFileSync(
				process.env.GITHUB_STEP_SUMMARY,
				releaseSummary(result),
			);
		console.log(releaseSummary(result));
	} catch (error) {
		console.error(`Release blocked: ${error.message}`);
		process.exitCode = 1;
	}
}
