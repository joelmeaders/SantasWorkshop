import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface Binding {
	role: string;
	members: string[];
	condition?: { expression: string; title: string };
}
const { assessReadiness } = createRequire(import.meta.url)(
	'../../../../scripts/remote-config-readiness.cjs',
) as {
	assessReadiness: (
		project: string,
		metrics: unknown,
		policy: { bindings: Binding[] },
		bucketPolicy: { bindings: Binding[] },
		env: Record<string, string>,
	) => { problems: string[]; templateReadsPerMinute: number };
};
const testProject = 'santas-workshop-test';
const prodProject = 'santas-workshop-193b5';
const fixture = (project = testProject, custom = false) => {
	const reader = `serviceAccount:${custom ? 'custom-reader' : 'remote-config-reader'}@${project}.iam.gserviceaccount.com`;
	const publisher = `serviceAccount:${custom ? 'custom-publisher' : 'remote-config-publisher'}@${project}.iam.gserviceaccount.com`;
	const policy = {
		bindings: [
			...['roles/cloudconfig.viewer', 'roles/datastore.user', 'roles/logging.logWriter'].map((role) => ({ role, members: [reader] })),
			...['roles/cloudconfig.admin', 'roles/logging.logWriter'].map((role) => ({ role, members: [publisher] })),
		] as Binding[],
	};
	const bucketPolicy = { bindings: [{ role: 'roles/storage.objectUser', members: [reader] }] as Binding[] };
	return { reader, publisher, policy, bucketPolicy };
};
const metrics = (effectiveLimit: number | string) => ({
	metrics: [{
		metric: 'firebaseremoteconfig.googleapis.com/read_requests',
		consumerQuotaLimits: [{ unit: '1/min/{project}', quotaBuckets: [{ effectiveLimit }] }],
	}],
});

describe('Remote Config release readiness', () => {
	it.each([59, 60, 61])('enforces the gateway budget of 60 reads/minute for quota %i', (quota) => {
		const { policy, bucketPolicy } = fixture();
		const result = assessReadiness(testProject, metrics(String(quota)), policy, bucketPolicy, {});
		expect(result.templateReadsPerMinute).toBe(quota);
		expect(result.problems).toHaveLength(quota < 60 ? 1 : 0);
	});
	it('rejects missing quota evidence instead of treating it as available capacity', () => {
		const { policy, bucketPolicy } = fixture();
		expect(assessReadiness(testProject, {}, policy, bucketPolicy, {}).problems).toEqual([
			expect.stringContaining('unknown/minute'),
		]);
	});
	it('requires project runtime roles and QR bucket access', () => {
		const { policy } = fixture();
		policy.bindings = policy.bindings.filter((binding) => binding.role !== 'roles/datastore.user');
		const result = assessReadiness(testProject, metrics(600), policy, { bindings: [] }, {});
		expect(result.problems).toEqual([
			expect.stringContaining('roles/datastore.user'),
			expect.stringContaining('Storage Object User'),
		]);
	});
	it.each([undefined, { expression: 'true', title: 'conditional' }])('rejects excess reader permissions including conditional grants', (condition) => {
		const { reader, policy, bucketPolicy } = fixture();
		policy.bindings.push({ role: 'roles/cloudconfig.admin', members: [reader], condition });
		expect(assessReadiness(testProject, metrics(600), policy, bucketPolicy, {}).problems).toEqual([
			expect.stringContaining('unexpected project roles'),
		]);
	});
	it('does not infer required access from a conditional grant', () => {
		const { policy, bucketPolicy } = fixture();
		policy.bindings[0].condition = { expression: 'false', title: 'deny' };
		bucketPolicy.bindings[0].condition = { expression: 'false', title: 'deny' };
		expect(assessReadiness(testProject, metrics(600), policy, bucketPolicy, {}).problems).toEqual([
			expect.stringContaining('roles/cloudconfig.viewer'),
			expect.stringContaining('cannot verify conditional access'),
		]);
	});
	it.each([[testProject, 'TEST'], [prodProject, 'PROD']])('checks the deployment identities configured for %s', (project, prefix) => {
		const { reader, publisher, policy, bucketPolicy } = fixture(project, true);
		const env = {
			[`${prefix}_SANTASHOP_REMOTE_CONFIG_READER_SERVICE_ACCOUNT`]: reader.replace('serviceAccount:', ''),
			[`${prefix}_SANTASHOP_REMOTE_CONFIG_PUBLISHER_SERVICE_ACCOUNT`]: publisher.replace('serviceAccount:', ''),
		};
		expect(assessReadiness(project, metrics(600), policy, bucketPolicy, env).problems).toEqual([]);
		expect(assessReadiness(project, metrics(600), policy, bucketPolicy, {}).problems.length).toBeGreaterThan(0);
	});
});
