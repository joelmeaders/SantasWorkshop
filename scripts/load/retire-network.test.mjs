import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retireNetwork } from './retire-network.mjs';
import { PROJECT, CONNECTOR } from './config.mjs';
const name = `projects/${PROJECT}/locations/us-central1/services/sender`;
const fixture = ({ attached = false, protectedRevision = false } = {}) => ({
	project: PROJECT,
	async list(url) {
		if (url.includes('cloudfunctions'))
			return [
				{
					state: 'ACTIVE',
					serviceConfig: attached ? { vpcConnector: CONNECTOR } : {},
				},
			];
		if (url.endsWith('/revisions'))
			return [
				{
					name: `${name}/revisions/isolated`,
					vpcAccess: { connector: CONNECTOR },
				},
			];
		throw new Error(`Unexpected list: ${url}`);
	},
	async request(url, options) {
		assert.notEqual(options?.method, 'DELETE', 'Unsafe deletion attempted');
		if (url.includes('serving.knative'))
			return {
				kind: 'ServiceList',
				items: [
					{
						metadata: {
							name: 'sender',
							labels: {
								'cloud.googleapis.com/location': 'us-central1',
							},
						},
					},
				],
			};
		if (url.endsWith('/services/sender'))
			return {
				name,
				latestReadyRevision: protectedRevision
					? `${name}/revisions/isolated`
					: `${name}/revisions/current`,
			};
		if (url.endsWith('/jobs')) return {};
		if (url.includes('/aggregated/instances')) return {};
		if (url.includes('/global/networks/')) return {};
		throw new Error(`Unexpected request: ${url}`);
	},
});
test('retirement refuses production before reading or deleting', async () => {
	await assert.rejects(
		retireNetwork({ ...fixture(), project: 'santas-workshop-193b5' }),
		/Only santas-workshop-test/,
	);
});
test('retirement refuses attached active functions before deleting', async () => {
	await assert.rejects(
		retireNetwork(fixture({ attached: true })),
		/Deploy normal test/,
	);
});
test('retirement protects isolated latest ready revisions', async () => {
	await assert.rejects(
		retireNetwork(fixture({ protectedRevision: true })),
		/serving or latest role/,
	);
});

