import { pathToFileURL } from 'node:url';
import {
	PROJECT,
	REGION,
	NETWORK,
	CONNECTOR,
	assertProject,
} from './config.mjs';
import { GoogleClient } from './google.mjs';
import { collectRunServices } from './isolation.mjs';

const compute = `https://compute.googleapis.com/compute/v1/projects/${PROJECT}`;
const networkUrl = `https://www.googleapis.com/compute/v1/projects/${PROJECT}/global/networks/${NETWORK}`;

async function waitOperation(client, operation, host) {
	if (operation?.error)
		throw new Error(
			`Retirement operation failed: ${JSON.stringify(operation.error)}`,
		);
	if (!operation || operation.done || operation.status === 'DONE') return;
	const version = host === 'run.googleapis.com' ? 'v2' : 'v1';
	const url =
		operation.selfLink ?? `https://${host}/${version}/${operation.name}`;
	for (let attempt = 0; attempt < 180; attempt++) {
		const current = await client.request(url);
		if (current.error)
			throw new Error(
				`Retirement operation failed: ${JSON.stringify(current.error)}`,
			);
		if (current.done || current.status === 'DONE') return;
		if (attempt % 6 === 0)
			console.log(
				'Waiting for the test infrastructure deletion to finish.',
			);
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}
	throw new Error(
		'Infrastructure deletion did not finish within 15 minutes. Recheck the live operation before retrying.',
	);
}

/** Retire only the named load network after every active service is detached. */
export async function retireNetwork(client) {
	assertProject(client.project);
	const functions = await client.list(
		`https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/-/functions`,
		'functions',
	);
	const services = await collectRunServices(client);
	if (!functions.length || !services.length)
		throw new Error('The active application inventory is missing.');
	if (
		functions.some(
			(fn) =>
				fn.state !== 'ACTIVE' ||
				fn.serviceConfig?.vpcConnector === CONNECTOR,
		)
	) {
		throw new Error(
			'Deploy normal test Functions and wait for ACTIVE state with no load connector before retirement.',
		);
	}
	if (
		services.some(
			(service) =>
				service.reconciling ||
				service.template?.vpcAccess?.connector === CONNECTOR,
		)
	) {
		throw new Error(
			'A live Cloud Run service is changing or still uses the load connector.',
		);
	}
	const jobs = await client.request(
		`https://run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs`,
	);
	if (
		jobs.items?.length ||
		jobs.metadata?.continue ||
		jobs.unreachable?.length
	)
		throw new Error('Cloud Run jobs require separate retirement review.');
	const instances = await client.request(`${compute}/aggregated/instances`);
	if (
		instances.nextPageToken ||
		Object.values(instances.items ?? {}).some((location) =>
			location.instances?.some((instance) =>
				instance.networkInterfaces?.some(
					(network) => network.network === networkUrl,
				),
			),
		)
	) {
		throw new Error(
			'Compute instances require separate load-network review.',
		);
	}
	const network = await client.request(networkUrl, { allow404: true });
	if (network?.peerings?.length)
		throw new Error('The load network has peerings that require review.');

	// Old isolated revisions cannot serve after their network is removed. Remove
	// only revisions without traffic, tags, or a latest-created/latest-ready role.
	let removedRevisions = 0;
	for (const service of services) {
		const protectedRevisions = new Set(
			[
				service.latestReadyRevision,
				service.latestCreatedRevision,
				...(service.trafficStatuses ?? []).map(
					(traffic) => traffic.revision,
				),
				...(service.traffic ?? []).map((traffic) => traffic.revision),
			]
				.filter(Boolean)
				.map((name) => name.split('/').at(-1)),
		);
		const revisions = await client.list(
			`https://run.googleapis.com/v2/${service.name}/revisions`,
			'revisions',
		);
		for (const revision of revisions) {
			if (revision.vpcAccess?.connector !== CONNECTOR) continue;
			if (protectedRevisions.has(revision.name.split('/').at(-1)))
				throw new Error(
					'An isolated revision still has a serving or latest role.',
				);
			const operation = await client.request(
				`https://run.googleapis.com/v2/${revision.name}`,
				{ method: 'DELETE' },
			);
			await waitOperation(client, operation, 'run.googleapis.com');
			removedRevisions++;
			// Leave room in the regional write quota for application operations.
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
	console.log(`Removed ${removedRevisions} non-serving isolated revisions.`);
	const connectorUrl = `https://vpcaccess.googleapis.com/v1/${CONNECTOR}`;
	if (await client.request(connectorUrl, { allow404: true })) {
		await waitOperation(
			client,
			await client.request(connectorUrl, { method: 'DELETE' }),
			'vpcaccess.googleapis.com',
		);
		console.log('Deleted load-email connector.');
	}
	for (const suffix of ['googleapis', 'run', 'functions']) {
		const zoneUrl = `https://dns.googleapis.com/dns/v1/projects/${PROJECT}/managedZones/${NETWORK}-${suffix}`;
		const zone = await client.request(zoneUrl, { allow404: true });
		if (!zone) continue;
		if (
			zone.visibility !== 'private' ||
			zone.privateVisibilityConfig?.networks?.length !== 1 ||
			zone.privateVisibilityConfig.networks[0].networkUrl !== networkUrl
		)
			throw new Error(
				'A load DNS zone is not private to the expected network.',
			);
		const records = await client.list(`${zoneUrl}/rrsets`, 'rrsets');
		const deletions = records.filter(
			(record) => !['NS', 'SOA'].includes(record.type),
		);
		if (deletions.length)
			await client.request(`${zoneUrl}/changes`, {
				method: 'POST',
				body: { deletions },
			});
		await client.request(zoneUrl, { method: 'DELETE' });
		console.log(`Deleted load DNS zone: ${suffix}.`);
	}
	const rules = await client.list(`${compute}/global/firewalls`, 'items');
	for (const rule of rules.filter((rule) => rule.network === networkUrl)) {
		await waitOperation(
			client,
			await client.request(`${compute}/global/firewalls/${rule.name}`, {
				method: 'DELETE',
			}),
			'compute.googleapis.com',
		);
	}
	const subnetUrl = `${compute}/regions/${REGION}/subnetworks/${NETWORK}`;
	const subnet = await client.request(subnetUrl, { allow404: true });
	if (subnet?.network !== undefined && subnet.network !== networkUrl)
		throw new Error('The named subnet belongs to another network.');
	if (subnet) {
		await waitOperation(
			client,
			await client.request(subnetUrl, { method: 'DELETE' }),
			'compute.googleapis.com',
		);
	}
	if (await client.request(networkUrl, { allow404: true })) {
		await waitOperation(
			client,
			await client.request(networkUrl, { method: 'DELETE' }),
			'compute.googleapis.com',
		);
	}
	console.log(
		'Deleted the isolated subnet, firewall rules, and VPC network.',
	);
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		if (
			process.argv.length !== 5 ||
			process.argv[2] !== '--project' ||
			process.argv[4] !== '--apply'
		) {
			throw new Error(
				'Usage: node scripts/load/retire-network.mjs --project santas-workshop-test --apply',
			);
		}
		assertProject(process.argv[3]);
		await retireNetwork(new GoogleClient(PROJECT));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
