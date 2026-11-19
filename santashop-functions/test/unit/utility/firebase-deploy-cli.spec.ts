import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';

const require = createRequire(import.meta.url);
interface Binding {
	role: string;
	members: string[];
	condition?: { title: string; expression: string };
}
interface Policy {
	bindings?: Binding[];
	etag?: string;
	version?: number;
}
interface CloudTasks {
	getIamPolicy: (name: string) => Promise<Policy>;
	setIamPolicy: (name: string, policy: Policy) => Promise<Policy>;
	setEnqueuer: (name: string, invokers: string[]) => Promise<void>;
}
const tasks = require('firebase-tools/lib/gcp/cloudtasks.js') as CloudTasks;
const queue =
	'projects/demo-santashop/locations/us-central1/queues/waitingListEmailWorker';
const account = 'task@demo-santashop.iam.gserviceaccount.com';
afterEach(() => {
	vi.restoreAllMocks();
});

const mockPolicy = (
	policy: Policy,
): MockInstance<CloudTasks['setIamPolicy']> => {
	vi.spyOn(tasks, 'getIamPolicy').mockResolvedValue(policy);
	return vi
		.spyOn(tasks, 'setIamPolicy')
		.mockImplementation(async (_name, value) => value);
};

describe('Firebase CLI Cloud Tasks IAM policy handling', () => {
	it('grants enqueue access when an empty policy omits bindings', async () => {
		const write = mockPolicy({ etag: 'ACAB' });
		await tasks.setEnqueuer(queue, [account]);
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(queue, {
			etag: 'ACAB',
			version: undefined,
			bindings: [
				{
					role: 'roles/cloudtasks.enqueuer',
					members: [`serviceAccount:${account}`],
				},
			],
		});
	});
	it('preserves unrelated conditional bindings, version, and the concurrency etag', async () => {
		const unrelated: Binding = {
			role: 'roles/cloudtasks.viewer',
			members: ['serviceAccount:auditor@example.com'],
			condition: {
				title: 'time-bound',
				expression: 'request.time < timestamp("2027-01-01T00:00:00Z")',
			},
		};
		const write = mockPolicy({
			etag: 'revision-1',
			version: 3,
			bindings: [unrelated],
		});
		await tasks.setEnqueuer(queue, [account]);
		expect(write.mock.calls[0][1]).toEqual({
			etag: 'revision-1',
			version: 3,
			bindings: [
				unrelated,
				{
					role: 'roles/cloudtasks.enqueuer',
					members: [`serviceAccount:${account}`],
				},
			],
		});
	});
	it('propagates a denied policy read without attempting a write', async () => {
		const write = mockPolicy({});
		const denied = new Error('Permission denied');
		vi.mocked(tasks.getIamPolicy).mockRejectedValue(denied);
		await expect(tasks.setEnqueuer(queue, [account])).rejects.toBe(denied);
		expect(write).not.toHaveBeenCalled();
	});
	it('propagates a denied policy write without adding retries', async () => {
		const write = mockPolicy({ etag: 'same' });
		const denied = new Error('Permission denied');
		write.mockRejectedValue(denied);
		await expect(tasks.setEnqueuer(queue, [account])).rejects.toBe(denied);
		expect(write).toHaveBeenCalledTimes(1);
	});
	it('does not grant public access when the configured invoker is private', async () => {
		const write = mockPolicy({
			etag: 'same',
			version: 3,
			bindings: [
				{
					role: 'roles/cloudtasks.enqueuer',
					members: [`serviceAccount:${account}`],
				},
			],
		});
		await tasks.setEnqueuer(queue, ['private']);
		expect(write).toHaveBeenCalledWith(queue, {
			etag: 'same',
			version: 3,
			bindings: [],
		});
	});
});

describe('Firebase deployment wrapper entrypoint', () => {
	const wrapperPath = fileURLToPath(
		new URL('../../../../scripts/firebase-deploy-cli.cjs', import.meta.url),
	);
	it.each([
		['false', 'test', 'deploy', 'GitHub Actions-only'],
		['true', 'invalid', 'deploy', 'must explicitly identify'],
		[
			'true',
			'test',
			'emulators:start',
			'only supports Firebase deployment',
		],
	])(
		'rejects actions=%s target=%s command=%s before starting the CLI',
		(actions, target, command, message) => {
			const result = spawnSync(process.execPath, [wrapperPath, command], {
				env: {
					...process.env,
					GITHUB_ACTIONS: actions,
					SANTASHOP_FUNCTIONS_DEPLOY: target,
				},
				encoding: 'utf8',
				timeout: 10_000,
			});
			expect(result.error).toBeUndefined();
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(message);
			expect(result.stdout).toBe('');
		},
	);
});
