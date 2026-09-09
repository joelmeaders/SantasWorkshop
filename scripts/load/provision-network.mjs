import { pathToFileURL } from 'node:url';
import {
	PROJECT,
	REGION,
	NETWORK,
	CONNECTOR_ID,
	CONNECTOR,
	GOOGLE_API_IPS,
	GOOGLE_API_RANGE,
	assertProject,
} from './config.mjs';
import { GoogleClient } from './google.mjs';

const compute = `https://compute.googleapis.com/compute/v1/projects/${PROJECT}`;
// Compute returns resource references using its legacy canonical hostname.
export const networkUrl = `https://www.googleapis.com/compute/v1/projects/${PROJECT}/global/networks/${NETWORK}`;
export const FIREWALL_RULES = [
	{
		name: `${NETWORK}-google`,
		priority: 80,
		destinationRanges: [GOOGLE_API_RANGE],
		allowed: [{ IPProtocol: 'tcp', ports: ['443'] }],
	},
	{
		name: `${NETWORK}-infrastructure`,
		priority: 80,
		destinationRanges: ['35.199.224.0/19'],
		allowed: [
			{ IPProtocol: 'tcp', ports: ['667'] },
			{ IPProtocol: 'udp', ports: ['665-666'] },
			{ IPProtocol: 'icmp' },
		],
	},
	{
		name: `${NETWORK}-deny`,
		priority: 90,
		destinationRanges: ['0.0.0.0/0'],
		denied: [{ IPProtocol: 'all' }],
	},
	{
		name: `${NETWORK}-deny-ipv6`,
		priority: 90,
		destinationRanges: ['::/0'],
		denied: [{ IPProtocol: 'all' }],
	},
].map((rule) => ({
	...rule,
	network: networkUrl,
	direction: 'EGRESS',
	disabled: false,
	logConfig: { enable: true, metadata: 'EXCLUDE_ALL_METADATA' },
}));

async function waitOperation(client, operation, service) {
	if (!operation || operation.status === 'DONE' || operation.done) return;
	const url = operation.selfLink ?? `https://${service}/v1/${operation.name}`;
	for (let attempt = 0; attempt < 180; attempt++) {
		const state = await client.request(url);
		if (state.error)
			throw new Error(
				`Infrastructure operation failed: ${JSON.stringify(state.error)}`,
			);
		if (state.status === 'DONE' || state.done) return;
		if (attempt % 6 === 0)
			console.log('Waiting for test network infrastructure operation.');
		await new Promise((resolve) => setTimeout(resolve, 10_000));
	}
	throw new Error(
		'Infrastructure operation did not finish within 30 minutes.',
	);
}

async function ensure(
	client,
	url,
	collectionUrl,
	body,
	service = 'compute.googleapis.com',
) {
	const current = await client.request(url, { allow404: true });
	if (current) {
		console.log(`Exists: ${body.name ?? url.split('/').at(-1)}`);
		return current;
	}
	const operation = await client.request(collectionUrl, {
		method: 'POST',
		body,
	});
	await waitOperation(client, operation, service);
	return client.request(url);
}

export async function provision(client) {
	assertProject(client.project);
	for (const api of [
		'compute.googleapis.com',
		'vpcaccess.googleapis.com',
		'dns.googleapis.com',
	]) {
		const url = `https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${api}`;
		const state = await client.request(url);
		if (state.state !== 'ENABLED') {
			await waitOperation(
				client,
				await client.request(`${url}:enable`, {
					method: 'POST',
					body: {},
				}),
				'serviceusage.googleapis.com',
			);
		}
	}
	const network = await ensure(
		client,
		networkUrl,
		`${compute}/global/networks`,
		{
			name: NETWORK,
			autoCreateSubnetworks: false,
			routingConfig: { routingMode: 'REGIONAL' },
		},
	);
	if (network.autoCreateSubnetworks || network.peerings?.length)
		throw new Error(
			'Existing isolation network has unexpected configuration.',
		);
	const subnet = await ensure(
		client,
		`${compute}/regions/${REGION}/subnetworks/${NETWORK}`,
		`${compute}/regions/${REGION}/subnetworks`,
		{
			name: NETWORK,
			network: networkUrl,
			ipCidrRange: '10.253.0.0/28',
			privateIpGoogleAccess: true,
			stackType: 'IPV4_ONLY',
		},
	);
	if (
		!subnet.privateIpGoogleAccess ||
		subnet.ipCidrRange !== '10.253.0.0/28' ||
		subnet.network !== networkUrl
	)
		throw new Error(
			'Existing isolation subnet differs from required configuration.',
		);
	for (const rule of FIREWALL_RULES) {
		await ensure(
			client,
			`${compute}/global/firewalls/${rule.name}`,
			`${compute}/global/firewalls`,
			rule,
		);
	}
	for (const [name, domain] of [
		['googleapis', 'googleapis.com.'],
		['run', 'run.app.'],
		['functions', 'cloudfunctions.net.'],
	]) {
		const zoneId = `${NETWORK}-${name}`;
		const zones = `https://dns.googleapis.com/dns/v1/projects/${PROJECT}/managedZones`;
		const zone = await client.request(`${zones}/${zoneId}`, {
			allow404: true,
		});
		if (!zone)
			await client.request(zones, {
				method: 'POST',
				body: {
					name: zoneId,
					dnsName: domain,
					description:
						'Google-only access for email-isolated acceptance tests.',
					visibility: 'private',
					privateVisibilityConfig: { networks: [{ networkUrl }] },
				},
			});
		const records =
			(await client.request(`${zones}/${zoneId}/rrsets`)).rrsets ?? [];
		const additions = [domain, `*.${domain}`]
			.filter(
				(record) =>
					!records.some(
						(item) => item.name === record && item.type === 'A',
					),
			)
			.map((record) => ({
				name: record,
				type: 'A',
				ttl: 60,
				rrdatas: GOOGLE_API_IPS,
			}));
		if (additions.length)
			await client.request(`${zones}/${zoneId}/changes`, {
				method: 'POST',
				body: { additions },
			});
	}
	const connectorUrl = `https://vpcaccess.googleapis.com/v1/${CONNECTOR}`;
	if (!(await client.request(connectorUrl, { allow404: true }))) {
		const operation = await client.request(
			`https://vpcaccess.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/connectors?connectorId=${CONNECTOR_ID}`,
			{
				method: 'POST',
				body: {
					subnet: { name: NETWORK, projectId: PROJECT },
					minInstances: 2,
					maxInstances: 3,
					machineType: 'e2-micro',
				},
			},
		);
		await waitOperation(client, operation, 'vpcaccess.googleapis.com');
	}
	console.log(
		'Test network provisioned. This does not authorize load; run the full deployed isolation gate first.',
	);
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		const project = process.argv[process.argv.indexOf('--project') + 1];
		assertProject(project);
		if (!process.argv.includes('--apply'))
			throw new Error(
				'Pass --apply to provision the named test-only resources.',
			);
		await provision(new GoogleClient(project));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
