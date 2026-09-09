import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
	PROJECT,
	REGION,
	NETWORK,
	CONNECTOR,
	GOOGLE_API_IPS,
	assertProject,
} from './config.mjs';
import { FIREWALL_RULES, networkUrl } from './provision-network.mjs';

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sorted = (values = []) => [...values].sort();
const awsKeys = (env = {}) =>
	Object.entries(env)
		.filter(
			([key, value]) =>
				/^(AWS_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NODE_OPTIONS$)/i.test(
					key,
				) && value,
		)
		.map(([key]) => key);

/** Pure policy evaluation is separately testable. No saved report can authorize a run. */
export function assessIsolation(snapshot, now = Date.now()) {
	const problems = [];
	if (snapshot.project !== PROJECT) problems.push('Unexpected project.');
	if (!snapshot.functions?.length)
		problems.push('No deployed Functions inventory.');
	if (snapshot.gen1?.length)
		problems.push('First-generation Functions require isolation review.');
	if (snapshot.jobs?.length)
		problems.push('Additional Cloud Run jobs require isolation review.');
	for (const queue of snapshot.queues ?? []) {
		if (
			queue.name !==
				`projects/${PROJECT}/locations/${REGION}/queues/ownerOperationWorker` ||
			queue.httpTarget ||
			queue.appEngineRoutingOverride ||
			!Array.isArray(queue.pendingTasks) ||
			queue.pendingTasks.length
		)
			problems.push(
				`Cloud Tasks queue has unreviewed or pending work: ${queue.name}.`,
			);
	}
	if (
		snapshot.network?.autoCreateSubnetworks ||
		snapshot.network?.peerings?.length
	)
		problems.push('Isolation network must be custom and unpeered.');
	if (
		!snapshot.subnet?.privateIpGoogleAccess ||
		snapshot.subnet?.network !== networkUrl ||
		snapshot.subnet?.stackType !== 'IPV4_ONLY'
	)
		problems.push(
			'Private Google Access IPv4-only subnet is not verified.',
		);
	if (
		snapshot.connector?.state !== 'READY' ||
		snapshot.connector?.name !== CONNECTOR ||
		snapshot.connector?.subnet?.name !== NETWORK
	)
		problems.push('Required VPC connector is not ready.');
	if (
		(snapshot.routers ?? []).some(
			(router) => router.network === networkUrl && router.nats?.length,
		)
	)
		problems.push('Isolation network has Cloud NAT.');
	for (const expected of FIREWALL_RULES) {
		const actual = snapshot.firewalls?.find(
			(rule) => rule.name === expected.name,
		);
		if (
			!actual ||
			actual.disabled ||
			actual.network !== networkUrl ||
			actual.direction !== 'EGRESS' ||
			actual.priority !== expected.priority ||
			actual.targetTags?.length ||
			actual.targetServiceAccounts?.length ||
			!same(
				sorted(actual.destinationRanges),
				sorted(expected.destinationRanges),
			) ||
			!same(actual.allowed ?? [], expected.allowed ?? []) ||
			!same(actual.denied ?? [], expected.denied ?? [])
		) {
			problems.push(
				`Firewall rule is missing or differs: ${expected.name}.`,
			);
		}
	}
	for (const rule of snapshot.firewalls ?? []) {
		if (
			rule.network === networkUrl &&
			rule.direction === 'EGRESS' &&
			!rule.disabled &&
			rule.allowed?.length &&
			rule.priority <= 90 &&
			!FIREWALL_RULES.some((expected) => expected.name === rule.name)
		)
			problems.push(
				`Unreviewed higher-priority egress allow: ${rule.name}.`,
			);
	}
	if (snapshot.effectiveFirewallPolicies?.length)
		problems.push('Additional effective firewall policies require review.');
	for (const zone of snapshot.dns ?? []) {
		if (zone.visibility !== 'private' || !same(zone.networks, [networkUrl]))
			problems.push(`Unexpected DNS visibility: ${zone.name}.`);
		for (const name of [zone.domain, `*.${zone.domain}`]) {
			const record = zone.records.find(
				(item) => item.type === 'A' && item.name === name,
			);
			if (
				!record ||
				!same(sorted(record.rrdatas), sorted(GOOGLE_API_IPS))
			)
				problems.push(`Private Google DNS missing: ${name}.`);
		}
	}
	if (snapshot.dns?.length !== 3)
		problems.push('Incomplete private DNS inventory.');
	const functionServices = new Set();
	for (const fn of snapshot.functions ?? []) {
		const service = fn.serviceConfig ?? {};
		const name = fn.name.split('/').at(-1);
		functionServices.add(service.service);
		if (fn.environment !== 'GEN_2' || fn.state !== 'ACTIVE')
			problems.push(`${name}: not an active second-generation Function.`);
		if (
			service.environmentVariables?.SANTASHOP_EMAIL_TRANSPORT !==
				'sink' ||
			service.vpcConnector !== CONNECTOR ||
			service.vpcConnectorEgressSettings !== 'ALL_TRAFFIC'
		)
			problems.push(
				`${name}: sink or all-traffic VPC routing is missing.`,
			);
		if (
			awsKeys(service.environmentVariables).length ||
			service.secretEnvironmentVariables?.length ||
			service.secretVolumes?.length
		)
			problems.push(
				`${name}: credentials, proxy configuration, or secret mounts remain.`,
			);
		const run = snapshot.services?.find(
			(item) => item.name === service.service,
		);
		if (!run) {
			problems.push(`${name}: Cloud Run service inventory missing.`);
			continue;
		}
		const containers = run.template?.containers ?? [];
		if (
			containers.length !== 1 ||
			containers.some((container) =>
				container.env?.some(
					(env) =>
						env.valueSource ||
						awsKeys({ [env.name]: env.value }).length,
				),
			)
		)
			problems.push(
				`${name}: unexpected containers, secrets, or credentials.`,
			);
		const vpc = run.template?.vpcAccess;
		if (vpc?.connector !== CONNECTOR || vpc?.egress !== 'ALL_TRAFFIC')
			problems.push(`${name}: Cloud Run VPC routing differs.`);
		const traffic = run.trafficStatuses ?? [];
		const revision = service.revision?.split('/').at(-1);
		if (
			!traffic.length ||
			traffic.some(
				(item) =>
					item.tag ||
					(
						item.revision ??
						(item.type === 'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST'
							? run.latestReadyRevision
							: undefined)
					)
						?.split('/')
						.at(-1) !== revision ||
					item.percent !== 100,
			)
		)
			problems.push(
				`${name}: old or tagged revisions can receive traffic.`,
			);
		const maxTimeoutMs =
			Math.max(service.timeoutSeconds ?? 60, 1800) * 1000;
		if (
			!fn.updateTime ||
			now - Date.parse(fn.updateTime) < maxTimeoutMs + 120_000
		)
			problems.push(
				`${name}: old workers have not passed the 32-minute quiescence window.`,
			);
	}
	for (const service of snapshot.services ?? []) {
		if (!functionServices.has(service.name))
			problems.push(`Unreviewed Cloud Run service: ${service.name}.`);
	}
	for (const job of snapshot.scheduler ?? []) {
		const uri = job.httpTarget?.uri;
		const targets = (snapshot.functions ?? []).flatMap((fn) => [
			fn.serviceConfig?.uri,
			`https://${REGION}-${PROJECT}.cloudfunctions.net/${fn.name.split('/').at(-1)}`,
		]);
		if (
			!uri ||
			!targets
				.map((target) => target?.replace(/\/$/, ''))
				.includes(uri.replace(/\/$/, ''))
		)
			problems.push(`Scheduler target requires review: ${job.name}.`);
	}
	for (const trigger of snapshot.triggers ?? []) {
		const destination = trigger.destination?.cloudRun;
		const covered = destination
			? functionServices.has(
					`projects/${PROJECT}/locations/${destination.region}/services/${destination.service}`,
				)
			: snapshot.functions.some(
					(fn) => fn.name === trigger.destination?.cloudFunction,
				);
		if (!covered)
			problems.push(
				`Eventarc destination requires review: ${trigger.name}.`,
			);
	}
	return problems;
}

export async function collectRunServices(client) {
	assertProject(client.project);
	const inventory = await client.request(
		`https://run.googleapis.com/apis/serving.knative.dev/v1/namespaces/${PROJECT}/services`,
	);
	if (
		inventory.kind !== 'ServiceList' ||
		inventory.metadata?.continue ||
		inventory.unreachable?.length ||
		!Array.isArray(inventory.items)
	)
		throw new Error('Cloud Run service inventory is incomplete.');
	return Promise.all(
		inventory.items.map((service) => {
			const region =
				service.metadata?.labels?.['cloud.googleapis.com/location'];
			const name = service.metadata?.name;
			if (
				!/^[a-z][a-z0-9-]+$/.test(region ?? '') ||
				!/^[a-z][a-z0-9-]+$/.test(name ?? '')
			)
				throw new Error('Cloud Run service identity is incomplete.');
			return client.request(
				`https://run.googleapis.com/v2/projects/${PROJECT}/locations/${region}/services/${name}`,
			);
		}),
	);
}

export async function collectIsolation(client) {
	assertProject(client.project);
	const base = `https://compute.googleapis.com/compute/v1/projects/${PROJECT}`;
	const functions = await client.list(
		`https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/-/functions`,
		'functions',
	);
	const v1 = await client.list(
		`https://cloudfunctions.googleapis.com/v1/projects/${PROJECT}/locations/-/functions`,
		'functions',
	);
	const services = await collectRunServices(client);
	// The v1 global endpoint provides the project-wide JobList. Any job blocks.
	const jobInventory = await client.request(
		`https://run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs`,
	);
	if (
		jobInventory.kind !== 'JobList' ||
		jobInventory.metadata?.continue ||
		jobInventory.unreachable?.length
	)
		throw new Error('Cloud Run job inventory is incomplete.');
	const jobs = jobInventory.items ?? [];
	const network = await client.request(networkUrl);
	const effective = await client.request(
		`${networkUrl}/getEffectiveFirewalls`,
	);
	const subnet = await client.request(
		`${base}/regions/${REGION}/subnetworks/${NETWORK}`,
	);
	const connector = await client.request(
		`https://vpcaccess.googleapis.com/v1/${CONNECTOR}`,
	);
	const firewalls = await client.list(`${base}/global/firewalls`, 'items');
	const routers = await client.list(
		`${base}/regions/${REGION}/routers`,
		'items',
	);
	const scheduler = [];
	const queues = [];
	for (const [host, version, resource, output] of [
		['cloudscheduler.googleapis.com', 'v1', 'jobs', scheduler],
		['cloudtasks.googleapis.com', 'v2', 'queues', queues],
	]) {
		const locations = await client.list(
			`https://${host}/${version}/projects/${PROJECT}/locations`,
			'locations',
		);
		output.push(
			...(
				await Promise.all(
					locations.map((location) =>
						client.list(
							`https://${host}/${version}/${location.name}/${resource}`,
							resource,
						),
					),
				)
			).flat(),
		);
	}
	for (const queue of queues)
		queue.pendingTasks = await client.list(
			`https://cloudtasks.googleapis.com/v2/${queue.name}/tasks`,
			'tasks',
		);
	const triggers = await client.list(
		`https://eventarc.googleapis.com/v1/projects/${PROJECT}/locations/-/triggers`,
		'triggers',
	);
	const dns = [];
	for (const [suffix, domain] of [
		['googleapis', 'googleapis.com.'],
		['run', 'run.app.'],
		['functions', 'cloudfunctions.net.'],
	]) {
		const name = `${NETWORK}-${suffix}`;
		const url = `https://dns.googleapis.com/dns/v1/projects/${PROJECT}/managedZones/${name}`;
		const zone = await client.request(url);
		const records = await client.list(`${url}/rrsets`, 'rrsets');
		dns.push({
			name,
			domain,
			visibility: zone.visibility,
			networks: zone.privateVisibilityConfig?.networks?.map(
				(item) => item.networkUrl,
			),
			records,
		});
	}
	return {
		project: PROJECT,
		checkedAt: new Date().toISOString(),
		functions,
		gen1: v1.filter((fn) => fn.environment !== 'GEN_2'),
		services,
		jobs,
		network,
		effectiveFirewallPolicies:
			effective.firewallPolicys ?? effective.firewallPolicies ?? [],
		subnet,
		connector,
		firewalls,
		routers,
		dns,
		scheduler,
		queues,
		triggers,
	};
}

export function isolationReport(snapshot, problems, probe) {
	// Deliberately whitelist report fields: never serialize live environment values.
	const revisions = snapshot.functions.map((fn) => ({
		name: fn.name.split('/').at(-1),
		revision: fn.serviceConfig?.revision,
		updatedAt: fn.updateTime,
	}));
	return {
		project: PROJECT,
		checkedAt: snapshot.checkedAt,
		passed: problems.length === 0,
		problems,
		revisions,
		connector: CONNECTOR,
		firewalls: snapshot.firewalls
			.filter((rule) => rule.network === networkUrl)
			.map(
				({
					name,
					priority,
					direction,
					destinationRanges,
					allowed,
					denied,
					disabled,
				}) => ({
					name,
					priority,
					direction,
					destinationRanges,
					allowed,
					denied,
					disabled,
				}),
			),
		schedulerJobs: snapshot.scheduler.map((job) => job.name),
		queues: snapshot.queues.map((queue) => queue.name),
		triggers: snapshot.triggers.map((trigger) => trigger.name),
		...(probe ? { probe } : {}),
	};
}

export async function requireIsolation(client, probeToken) {
	const snapshot = await collectIsolation(client);
	const problems = assessIsolation(snapshot);
	const source = await readFile(
		new URL('../../santashop-functions/src/index.ts', import.meta.url),
		'utf8',
	);
	const expected = [
		...source
			.split(
				'// ------------------------------------- TEST HELPER FUNCTIONS',
			)[0]
			.matchAll(/^export const (\w+)\s*=/gm),
	]
		.map((match) => match[1])
		.sort();
	const actual = snapshot.functions
		.map((fn) => fn.name.split('/').at(-1))
		.sort();
	if (!same(expected, actual))
		problems.push(
			'Deployed Function inventory does not match this checkout.',
		);
	let probe;
	if (!problems.length) {
		if (!probeToken)
			problems.push(
				'An identity token for the private emailIsolationProbe is required.',
			);
		else {
			const fn = snapshot.functions.find((item) =>
				item.name.endsWith('/emailIsolationProbe'),
			);
			const response = await fetch(fn.serviceConfig.uri, {
				method: 'GET',
				redirect: 'error',
				headers: { Authorization: `Bearer ${probeToken}` },
				signal: AbortSignal.timeout(20_000),
			});
			probe = await response.json();
			if (
				!response.ok ||
				probe.simulated !== true ||
				probe.awsConfigurationPresent !== false ||
				!probe.googleReachable ||
				probe.probes?.length !== 4 ||
				probe.probes.some((item) => item.reachable !== false) ||
				probe.revision !== fn.serviceConfig.revision?.split('/').at(-1)
			)
				problems.push(
					'The deployed negative-connectivity probe did not pass.',
				);
		}
	}
	const report = isolationReport(snapshot, problems, probe);
	if (problems.length) {
		const error = new Error(
			`EMAIL ISOLATION BLOCKED: ${problems.join(' ')}`,
		);
		error.report = report;
		throw error;
	}
	return {
		report,
		fingerprint: createHash('sha256')
			.update(JSON.stringify(report.revisions))
			.digest('hex'),
		snapshot,
	};
}
