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
const { normalizeQueuePolicy, installQueuePolicyCompatibility } = require(
	'../../../../scripts/firebase-deploy-cli.cjs',
) as {
	normalizeQueuePolicy: (policy: unknown) => Policy;
	installQueuePolicyCompatibility: (tasks: CloudTasks, version: string) => () => void;
};
const tasks = require('firebase-tools/lib/gcp/cloudtasks.js') as CloudTasks;
const { version } = require('firebase-tools/package.json') as { version: string };
const queue = 'projects/demo-santashop/locations/us-central1/queues/waitingListEmailWorker';
const account = 'task@demo-santashop.iam.gserviceaccount.com';
let restore: (() => void) | undefined;
afterEach(() => {
	restore?.();
	restore = undefined;
	vi.restoreAllMocks();
});

const mockPolicy = (policy: Policy): MockInstance<CloudTasks['setIamPolicy']> => {
	vi.spyOn(tasks, 'getIamPolicy').mockResolvedValue(policy);
	return vi.spyOn(tasks, 'setIamPolicy').mockImplementation(async (_name, value) => value);
};

describe('Firebase CLI empty Cloud Tasks IAM policy compatibility', () => {
	it('reproduces the pinned CLI failure and fixes it without changing its intended grant', async () => {
		const write = mockPolicy({ etag: 'ACAB' });
		await expect(tasks.setEnqueuer(queue, [account])).rejects.toThrow('filter');
		expect(write).not.toHaveBeenCalled();
		restore = installQueuePolicyCompatibility(tasks, version);
		await tasks.setEnqueuer(queue, [account]);
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(queue, {
			etag: 'ACAB', version: undefined,
			bindings: [{ role: 'roles/cloudtasks.enqueuer', members: [`serviceAccount:${account}`] }],
		});
	});
	it('preserves unrelated conditional bindings, version, and the concurrency etag', async () => {
		const unrelated: Binding = {
			role: 'roles/cloudtasks.viewer', members: ['serviceAccount:auditor@example.com'],
			condition: { title: 'time-bound', expression: 'request.time < timestamp("2027-01-01T00:00:00Z")' },
		};
		const write = mockPolicy({ etag: 'revision-1', version: 3, bindings: [unrelated] });
		restore = installQueuePolicyCompatibility(tasks, version);
		await tasks.setEnqueuer(queue, [account]);
		expect(write.mock.calls[0][1]).toEqual({
			etag: 'revision-1', version: 3,
			bindings: [unrelated, { role: 'roles/cloudtasks.enqueuer', members: [`serviceAccount:${account}`] }],
		});
	});
	it('leaves an existing policy object and its bindings untouched', () => {
		const policy = Object.freeze({ etag: 'same', bindings: Object.freeze([]) });
		expect(normalizeQueuePolicy(policy)).toBe(policy);
	});
	it('does not mutate an empty response or discard additional response fields', () => {
		const policy = Object.freeze({ etag: 'same', version: 3, additionalField: 'keep' });
		expect(normalizeQueuePolicy(policy)).toEqual({ ...policy, bindings: [] });
		expect(policy).not.toHaveProperty('bindings');
	});
	it.each([null, undefined, [], 'invalid', { bindings: null }, { bindings: {} }])(
		'rejects malformed policy %j rather than replacing it', (policy) => {
			expect(() => normalizeQueuePolicy(policy)).toThrow('Invalid Cloud Tasks IAM');
		},
	);
	it('propagates a denied policy read without attempting a write', async () => {
		const write = mockPolicy({});
		const denied = new Error('Permission denied');
		vi.mocked(tasks.getIamPolicy).mockRejectedValue(denied);
		restore = installQueuePolicyCompatibility(tasks, version);
		await expect(tasks.setEnqueuer(queue, [account])).rejects.toBe(denied);
		expect(write).not.toHaveBeenCalled();
	});
	it('propagates a denied policy write without adding retries', async () => {
		const write = mockPolicy({ etag: 'same' });
		const denied = new Error('Permission denied');
		write.mockRejectedValue(denied);
		restore = installQueuePolicyCompatibility(tasks, version);
		await expect(tasks.setEnqueuer(queue, [account])).rejects.toBe(denied);
		expect(write).toHaveBeenCalledTimes(1);
	});
	it('does not grant public access when the configured invoker is private', async () => {
		const write = mockPolicy({ etag: 'same', version: 3, bindings: [
			{ role: 'roles/cloudtasks.enqueuer', members: [`serviceAccount:${account}`] },
		] });
		restore = installQueuePolicyCompatibility(tasks, version);
		await tasks.setEnqueuer(queue, ['private']);
		expect(write).toHaveBeenCalledWith(queue, { etag: 'same', version: 3, bindings: [] });
	});
	it('requires review on a CLI version change before modifying the reader', () => {
		const original = tasks.getIamPolicy;
		expect(() => installQueuePolicyCompatibility(tasks, 'unreviewed')).toThrow('Review');
		expect(tasks.getIamPolicy).toBe(original);
	});
});
