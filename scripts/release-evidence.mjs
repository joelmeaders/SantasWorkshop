import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workflow = (unit) =>
	`.github/workflows/${unit}-test-and-prod-release.yml`;
const shaPattern = /^[0-9a-f]{40}$/;

export function githubApi(token, repository, fetchImpl = fetch) {
	if (!token)
		throw new Error('GITHUB_TOKEN is required to resolve the release.');
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
				`Cannot resolve the release (${path}); check GitHub connectivity and retry.`,
			);
		}
		if (!response.ok)
			throw new Error(
				`Cannot resolve the release (${path}): HTTP ${response.status}. Check contents:read permissions.`,
			);
		return response.json();
	};
}

export async function verifyRelease(options, api) {
	const {
		releaseRef,
		unit,
		mode,
		repository,
		workflowRef,
		actor,
		skipTests: requestedSkip = false,
		commitMessage = '',
	} = options;
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
	if (typeof requestedSkip !== 'boolean')
		throw new Error('skip_tests must be a boolean.');
	if (typeof commitMessage !== 'string')
		throw new Error('commit_message must be a string.');
	// Only an explicit subject marker skips tests; PR descriptions can mention it.
	const skipTests =
		requestedSkip ||
		commitMessage
			.split(/\r?\n/, 1)[0]
			.toLowerCase()
			.includes('[skip tests]');
	if ((mode === 'prod' || skipTests) && actor !== repository.split('/')[0])
		throw new Error(
			'Only the repository owner can request skipped test suites or production promotion.',
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
	return { sha, unit, mode, skipTests, actor };
}

export function releaseSummary(result) {
	return [
		`### Release selection: ${result.unit}`,
		`- Immutable SHA: \`${result.sha}\``,
		`- Test suites: ${result.skipTests ? 'SKIPPED by owner ' + result.actor : 'enabled; skipped jobs do not block promotion'}.`,
		'- TEST deployment must succeed in this workflow run before production is offered.',
		'- Production waits for the production environment approval. This gate does not approve or deploy.',
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
				commitMessage: process.env.RELEASE_COMMIT_MESSAGE,
				skipTests: process.env.RELEASE_SKIP_TESTS === 'true',
			},
			githubApi(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY),
		);
		if (process.env.GITHUB_OUTPUT)
			appendFileSync(
				process.env.GITHUB_OUTPUT,
				`sha=${result.sha}\nskip_tests=${result.skipTests}\n`,
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
