import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workflow = (unit) =>
	`.github/workflows/${unit}-test-and-prod-release.yml`;
const storybook = '.github/workflows/storybook-pr-validation.yml';
const shaPattern = /^[0-9a-f]{40}$/;

export function requirements(unit, deploymentRequired) {
	const units = [unit];
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
						steps: ['Functions integration tests'],
					},
					...['app', 'admin'].map((browserTarget) => ({
						path: workflow(target),
						job: `e2e (${browserTarget}) / test`,
						steps: ['Customer or staff E2E tests'],
					})),
				]
			: [
					{
						path: workflow(target),
						job: 'release / validate_release',
						steps: [
							'Customer or staff E2E tests',
							'Run target unit tests with prepared shared libraries',
						],
					},
				],
	);
	if (unit !== 'functions')
		result.push({
			path: storybook,
			job: `storybook_behavior (${unit})`,
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

function trustedRun(run, path, repository) {
	return (
		Number.isSafeInteger(run.id) &&
		run.id > 0 &&
		Number.isSafeInteger(run.workflow_id) &&
		run.workflow_id > 0 &&
		run.repository?.full_name === repository &&
		run.head_repository?.full_name === repository &&
		run.path?.split('@')[0] === path &&
		run.head_branch === 'master' &&
		['push', 'workflow_dispatch'].includes(run.event) &&
		run.status === 'completed' &&
		run.conclusion === 'success' &&
		Number.isInteger(run.run_attempt) &&
		run.run_attempt > 0 &&
		shaPattern.test(run.head_sha ?? '')
	);
}

function matchesRequirement(jobs, requirement, sha) {
	const matchingJobs = jobs.filter((job) => job.name === requirement.job);
	if (matchingJobs.length !== 1) return false;
	const [job] = matchingJobs;
	if (
		job.status !== 'completed' ||
		job.conclusion !== 'success' ||
		!Array.isArray(job.steps)
	)
		return false;
	if (
		job.steps.filter((step) => step.name?.startsWith('Release revision '))
			.length !== 1
	)
		return false;
	return [`Release revision ${sha}`, ...requirement.steps].every((name) => {
		const steps = job.steps.filter((step) => step.name === name);
		return (
			steps.length === 1 &&
			steps[0].status === 'completed' &&
			steps[0].conclusion === 'success'
		);
	});
}

async function findEvidence(required, sha, repository, api, readTrusted) {
	const verified = new Map();
	const usedRuns = new Map();
	const identities = new Map();
	const sourceMatches = new Map();
	for (const path of new Set(required.map((item) => item.path))) {
		const expected = required.filter((item) => item.path === path);
		const seen = new Set();
		const rejected = [];
		for (
			let page = 1;
			page <= 10 && expected.some((item) => !verified.has(item));
			page++
		) {
			// Dispatch head_sha identifies workflow source, not the selected release.
			// Do not filter discovery by head_sha; verify checkout markers below.
			const response = await api(
				`actions/workflows/${path.split('/').at(-1)}/runs?branch=master&status=success&per_page=100&page=${page}`,
			);
			if (!Array.isArray(response.workflow_runs))
				throw new Error(
					'GitHub returned an invalid workflow run list.',
				);
			for (const listed of response.workflow_runs) {
				if (
					seen.has(listed.id) ||
					!trustedRun(listed, path, repository)
				)
					continue;
				seen.add(listed.id);
				if (listed.event === 'push' && listed.head_sha !== sha)
					continue;
				const run = await api(`actions/runs/${listed.id}`);
				if (run.id !== listed.id || !trustedRun(run, path, repository))
					continue;
				if (!identities.has(run.workflow_id))
					identities.set(
						run.workflow_id,
						await api(`actions/workflows/${run.workflow_id}`),
					);
				const identity = identities.get(run.workflow_id);
				if (identity.path !== path || identity.id !== run.workflow_id) {
					rejected.push(
						`Run ${run.id} has an unexpected workflow identity.`,
					);
					continue;
				}
				const jobs = [];
				for (let jobPage = 1; ; jobPage++) {
					const response = await api(
						`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${jobPage}`,
					);
					if (!Array.isArray(response.jobs))
						throw new Error(`Run ${run.id} returned invalid jobs.`);
					jobs.push(...response.jobs);
					if (response.jobs.length < 100) break;
					if (jobPage >= 20)
						throw new Error(
							`Run ${run.id} has too many jobs to verify safely.`,
						);
				}
				const matches = expected.filter(
					(item) =>
						!verified.has(item) &&
						matchesRequirement(jobs, item, sha),
				);
				if (!matches.length) continue;
				const sources = [
					path,
					'.github/workflows/ci-changes.yml',
					'scripts/ci-changes.mjs',
					'scripts/ci-config-impact.mjs',
					'scripts/ui-targets.mjs',
				];
				if (path !== storybook)
					sources.push(
						'.github/workflows/release-gate.yml',
						'scripts/release-evidence.mjs',
					);
				if (path === workflow('app') || path === workflow('admin'))
					sources.push('.github/workflows/ui-target.yml');
				if (path === workflow('functions'))
					sources.push('.github/workflows/e2e-target.yml');
				let trustedSource = true;
				for (const source of sources) {
					const key = `${run.head_sha}:${source}`;
					if (!sourceMatches.has(key)) {
						const content = await api(
							`contents/${source}?ref=${run.head_sha}`,
						);
						sourceMatches.set(
							key,
							content.encoding === 'base64' &&
								Buffer.from(content.content ?? '', 'base64')
									.toString('utf8')
									.replaceAll('\r\n', '\n') ===
									readTrusted(source).replaceAll(
										'\r\n',
										'\n',
									),
						);
					}
					if (!sourceMatches.get(key)) {
						rejected.push(
							`Run ${run.id} used a different evidence producer (${source}).`,
						);
						trustedSource = false;
						break;
					}
				}
				if (!trustedSource) continue;
				for (const item of matches)
					verified.set(item, {
						checks: item.steps,
						runId: run.id,
						url: `https://github.com/${repository}/actions/runs/${run.id}`,
					});
				usedRuns.set(run.id, run);
				if (expected.every((item) => verified.has(item))) break;
			}
			if (response.workflow_runs.length < 100) break;
		}
		const missing = expected.filter((item) => !verified.has(item));
		if (missing.length)
			throw new Error(
				`Missing successful exact-SHA evidence for ${sha}: ${missing.map((item) => `${item.job} / ${item.steps.join(', ')}`).join('; ')}. ${rejected.slice(0, 3).join(' ')} Run the missing test or Storybook workflow from master with release_ref=${sha}, then retry production. Discovery checks up to 1,000 recent successful runs per workflow; failed, skipped, untrusted, and PR evidence do not qualify.`,
			);
	}
	// Do not promote using an attempt that changed while evidence was being read.
	for (const [id, previous] of usedRuns) {
		const current = await api(`actions/runs/${id}`);
		if (
			current.id !== id ||
			!trustedRun(current, previous.path.split('@')[0], repository) ||
			current.run_attempt !== previous.run_attempt ||
			current.head_sha !== previous.head_sha
		)
			throw new Error(
				`Evidence run ${id} changed during verification. Retry after that run completes.`,
			);
	}
	return required.map((item) => verified.get(item));
}

export async function verifyRelease(
	options,
	api,
	readTrusted = (path) => readFileSync(path, 'utf8'),
) {
	const { releaseRef, unit, mode, repository, workflowRef, actor } = options;
	if (
		typeof releaseRef !== 'string' ||
		!releaseRef ||
		releaseRef.length > 1024 ||
		/\s/.test(releaseRef)
	)
		throw new Error(
			'Select a release tag, branch, or commit in release_ref.',
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
	if (mode === 'prod' && actor !== repository.split('/')[0])
		throw new Error(
			'The repository owner must invoke production deployment.',
		);
	// Resolve once. Every later checkout and evidence comparison uses this SHA.
	const commit = await api(`commits/${encodeURIComponent(releaseRef)}`);
	const sha = commit.sha;
	if (
		!shaPattern.test(sha ?? '') ||
		(/^[0-9a-f]{40}$/i.test(releaseRef) && sha !== releaseRef.toLowerCase())
	)
		throw new Error(
			'The selected release does not resolve to the requested immutable commit.',
		);
	const ancestry = await api(`compare/${sha}...master`);
	if (!['ahead', 'identical'].includes(ancestry.status))
		throw new Error(
			'The selected commit must be on master (an ancestor of its current tip).',
		);
	const verified =
		mode === 'prod'
			? await findEvidence(
					requirements(unit, true),
					sha,
					repository,
					api,
					readTrusted,
				)
			: [];
	return {
		sha,
		unit,
		mode,
		verified,
		approval: mode === 'prod' ? actor : null,
		reuse: mode === 'prod',
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
		`- Tests: ${result.reuse ? 'automatically discovered and verified exact-SHA evidence reused; no suite rerun' : 'fresh suites required in this test run'}.`,
		`- Approval: ${result.approval ? `owner ${result.approval} invoked production deployment; evidence was verified automatically` : 'test target; no production approval'}.`,
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
				releaseRef: process.env.RELEASE_REF,
				unit: process.env.RELEASE_UNIT,
				mode: process.env.RELEASE_MODE,
				repository: process.env.GITHUB_REPOSITORY,
				workflowRef: process.env.RELEASE_WORKFLOW_REF,
				actor: process.env.RELEASE_ACTOR,
			},
			githubApi(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY),
		);
		if (process.env.GITHUB_OUTPUT)
			appendFileSync(
				process.env.GITHUB_OUTPUT,
				`sha=${result.sha}\nreuse_tests=${result.reuse}\n`,
			);
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
