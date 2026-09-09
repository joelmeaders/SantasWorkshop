import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessIsolation, collectRunServices } from './isolation.mjs';
import { FIREWALL_RULES, networkUrl } from './provision-network.mjs';
import {
	PROJECT,
	NETWORK,
	CONNECTOR,
	GOOGLE_API_IPS,
	assertProject,
	assertRunId,
	TARGETS,
	isCustomerCallable,
} from './config.mjs';

test('hosted callable capture includes Hosting rewrites and excludes other traffic', () => {
	const config = { customerOrigin: 'https://test.denversantaclausshop.org' };
	assert.equal(
		isCustomerCallable(
			config,
			`${config.customerOrigin}/newAccount`,
			'POST',
		),
		true,
	);
	assert.equal(
		isCustomerCallable(
			config,
			`https://us-central1-${PROJECT}.cloudfunctions.net/newAccount`,
			'POST',
		),
		true,
	);
	assert.equal(
		isCustomerCallable(config, `${config.customerOrigin}/sign-up`, 'GET'),
		false,
	);
	assert.equal(
		isCustomerCallable(
			config,
			'https://register.denversantaclausshop.org/newAccount',
			'POST',
		),
		false,
	);
	assert.equal(
		isCustomerCallable(
			config,
			`${config.customerOrigin}/assets/config.json`,
			'POST',
		),
		false,
	);
});

test('global service inventory reads full configuration in every listed region', async () => {
	const calls = [];
	const client = {
		project: PROJECT,
		request: async (url) => {
			calls.push(url);
			if (url.includes('/namespaces/'))
				return {
					kind: 'ServiceList',
					items: ['us-central1', 'europe-west1'].map((region) => ({
						metadata: {
							name: 'example',
							labels: { 'cloud.googleapis.com/location': region },
						},
					})),
				};
			return { name: url };
		},
	};
	const services = await collectRunServices(client);
	assert.equal(services.length, 2);
	assert.ok(calls[1].endsWith('/locations/us-central1/services/example'));
	assert.ok(calls[2].endsWith('/locations/europe-west1/services/example'));
});

test('global service inventory rejects incomplete lists and unknown identities', async () => {
	for (const inventory of [
		{ kind: 'ServiceList', items: [], metadata: { continue: 'more' } },
		{ kind: 'ServiceList', items: [], unreachable: ['region'] },
		{ kind: 'ServiceList' },
		{ kind: 'ServiceList', items: [{ metadata: { name: 'example' } }] },
	]) {
		await assert.rejects(
			collectRunServices({
				project: PROJECT,
				request: async () => inventory,
			}),
			/incomplete/,
		);
	}
});

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
