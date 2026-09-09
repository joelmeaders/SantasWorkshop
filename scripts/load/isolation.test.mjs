import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessIsolation } from './isolation.mjs';
import { FIREWALL_RULES, networkUrl } from './provision-network.mjs';
import {
	PROJECT,
	NETWORK,
	CONNECTOR,
	GOOGLE_API_IPS,
	assertProject,
	assertRunId,
	TARGETS,
} from './config.mjs';

function safeSnapshot() {
	const name = `projects/${PROJECT}/locations/us-central1/services/emailisolationprobe`;
	return {
		project: PROJECT,
		gen1: [],
		jobs: [],
		network: { autoCreateSubnetworks: false },
		subnet: {
			privateIpGoogleAccess: true,
			network: networkUrl,
			stackType: 'IPV4_ONLY',
		},
		connector: {
			state: 'READY',
			name: CONNECTOR,
			subnet: { name: NETWORK },
		},
		routers: [],
		effectiveFirewallPolicies: [],
		firewalls: structuredClone(FIREWALL_RULES),
		dns: ['googleapis.com.', 'run.app.', 'cloudfunctions.net.'].map(
			(domain) => ({
				name: domain,
				domain,
				visibility: 'private',
				networks: [networkUrl],
				records: [domain, `*.${domain}`].map((name) => ({
					name,
					type: 'A',
					rrdatas: GOOGLE_API_IPS,
				})),
			}),
		),
		functions: [
			{
				name: 'emailIsolationProbe',
				state: 'ACTIVE',
				environment: 'GEN_2',
				updateTime: '2026-01-01T00:00:00Z',
				serviceConfig: {
					service: name,
					revision: 'probe-1',
					environmentVariables: { SANTASHOP_EMAIL_TRANSPORT: 'sink' },
					vpcConnector: CONNECTOR,
					vpcConnectorEgressSettings: 'ALL_TRAFFIC',
				},
			},
		],
		services: [
			{
				name,
				uri: 'https://probe.run.app',
				template: {
					containers: [{ env: [] }],
					vpcAccess: { connector: CONNECTOR, egress: 'ALL_TRAFFIC' },
				},
				trafficStatuses: [{ revision: 'probe-1', percent: 100 }],
			},
		],
		scheduler: [],
	};
}

test('project and run guards reject accidental targets', () => {
	assert.throws(() => assertProject('santas-workshop-193b5'));
	assert.throws(() => assertProject(undefined));
	assert.throws(() => assertRunId('../fixture'));
	assertRunId('load-20260909T000000Z-1234abcd');
	assert.equal(
		TARGETS.signup.count / (TARGETS.signup.durationMs / 1000),
		1.2,
	);
});
test('requires independent firewall, credential removal, private DNS, and revision retirement', () => {
	assert.deepEqual(assessIsolation(safeSnapshot()), []);
	for (const mutate of [
		(s) => s.firewalls.pop(),
		(s) =>
			(s.functions[0].serviceConfig.environmentVariables.AWS_ACCESS_KEY_ID =
				'unexpected'),
		(s) =>
			(s.functions[0].serviceConfig.vpcConnectorEgressSettings =
				'PRIVATE_RANGES_ONLY'),
		(s) => (s.services[0].trafficStatuses[0].tag = 'old'),
		(s) =>
			s.services[0].template.containers[0].env.push({
				name: 'SECRET',
				valueSource: {},
			}),
		(s) => (s.functions[0].updateTime = new Date().toISOString()),
		(s) => (s.dns[0].records[0].rrdatas = ['1.2.3.4']),
		(s) =>
			s.firewalls.push({
				name: 'escape',
				network: networkUrl,
				direction: 'EGRESS',
				priority: 10,
				allowed: [{ IPProtocol: 'all' }],
			}),
		(s) => s.jobs.push({ name: 'unreviewed-worker' }),
	]) {
		const snapshot = safeSnapshot();
		mutate(snapshot);
		assert.ok(assessIsolation(snapshot).length > 0);
	}
});
