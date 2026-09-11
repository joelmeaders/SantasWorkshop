import { readFileSync } from 'node:fs';
import { requirements } from './release-evidence.mjs';

export const releaseSha = 'a'.repeat(40);
export const workflowSha = 'b'.repeat(40);
export const repository = 'joelmeaders/SantasWorkshop';

export function fixture(unit = 'functions') {
	const required = requirements(unit, true);
	const runs = [];
	const jobs = new Map();
	for (const requirement of required) {
		let run = runs.find(({ path }) => path === requirement.path);
		if (!run) {
			run = {
				id: runs.length + 101,
				path: requirement.path,
				workflow_id: runs.length + 501,
				run_attempt: 1,
				repository: { full_name: repository },
				head_repository: { full_name: repository },
				head_branch: 'master',
				head_sha: workflowSha,
				event: 'workflow_dispatch',
				status: 'completed',
				conclusion: 'success',
			};
			runs.push(run);
			jobs.set(run.id, []);
		}
		let job = jobs.get(run.id).find(({ name }) => name === requirement.job);
		if (!job) {
			job = {
				name: requirement.job,
				status: 'completed',
				conclusion: 'success',
				steps: [
					{
						name: `Release revision ${releaseSha}`,
						status: 'completed',
						conclusion: 'success',
					},
				],
			};
			jobs.get(run.id).push(job);
		}
		job.steps.push(
			...requirement.steps.map((name) => ({
				name,
				status: 'completed',
				conclusion: 'success',
			})),
		);
	}
	const options = {
		releaseRef: releaseSha,
		unit,
		mode: 'prod',
		repository,
		workflowRef: `${repository}/.github/workflows/${unit}-test-and-prod-release.yml@refs/heads/master`,
		actor: 'joelmeaders',
	};
	const api = async (path) => {
		if (path === `commits/${releaseSha}`) return { sha: releaseSha };
		if (path === `compare/${releaseSha}...master`)
			return { status: 'ahead' };
		const listing = path.match(
			/^actions\/workflows\/([^/]+)\/runs\?.*page=(\d+)$/,
		);
		if (listing)
			return {
				workflow_runs:
					Number(listing[2]) === 1
						? runs.filter((run) => run.path.endsWith(listing[1]))
						: [],
			};
		const run = runs.find(({ id }) => path === `actions/runs/${id}`);
		if (run) return run;
		const workflow = runs.find(
			({ workflow_id }) => path === `actions/workflows/${workflow_id}`,
		);
		if (workflow) return { id: workflow.workflow_id, path: workflow.path };
		const jobRun = runs.find(
			({ id, run_attempt }) =>
				path ===
				`actions/runs/${id}/attempts/${run_attempt}/jobs?per_page=100&page=1`,
		);
		if (jobRun) return { jobs: jobs.get(jobRun.id) };
		if (path.startsWith('contents/'))
			return {
				encoding: 'base64',
				content: readFileSync(
					path.slice('contents/'.length).split('?')[0],
				).toString('base64'),
			};
		throw new Error(`Unexpected fixture API request: ${path}`);
	};
	return { options, api, runs, jobs };
}
