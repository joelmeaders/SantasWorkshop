import { PROJECT, TARGETS } from './config.mjs';

/** Conservative compute ceiling, with no free-tier credits. Not a billing export. */
export function costCeiling(snapshot, elapsedSeconds, remainingSeconds = 0) {
	let dollarsPerSecond = 0;
	for (const fn of snapshot.functions) {
		const config = fn.serviceConfig;
		const cpu = Number(config.availableCpu);
		const memory = /^(\d+)(M|G|Mi|Gi)$/.exec(config.availableMemory ?? '');
		const maximum = config.maxInstanceCount;
		if (!(cpu > 0) || !memory || !(maximum > 0))
			throw new Error(
				'A deployed compute limit is missing; cost cannot be bounded.',
			);
		const gib =
			Number(memory[1]) * (memory[2].startsWith('G') ? 1 : 1 / 1024);
		// Round published Tier 1 rates upward: CPU $0.000024 and memory $0.0000025.
		dollarsPerSecond += maximum * (cpu * 0.00003 + gib * 0.000003);
	}
	// Up to three connector VMs at a deliberately rounded-up $0.02/hour each.
	dollarsPerSecond += 0.06 / 3600;
	// $5 allowance for requests, database, storage, App Check, DNS, logging and build.
	return {
		method: 'full-configured-instance-ceiling',
		allowanceUsd: 5,
		dollarsPerSecond,
		elapsedCeilingUsd: 5 + elapsedSeconds * dollarsPerSecond,
		projectedCeilingUsd:
			5 + (elapsedSeconds + remainingSeconds) * dollarsPerSecond,
		actualBilledUsd: null,
	};
}

export function enforceBudget(cost, beforeMainLoad = false) {
	if (
		cost.elapsedCeilingUsd >= TARGETS.arrivalStopUsd ||
		(beforeMainLoad && cost.projectedCeilingUsd >= TARGETS.arrivalStopUsd)
	)
		throw new Error(
			'Conservative cost ceiling reached the $20 arrival limit.',
		);
}

export async function instanceEvidence(client, snapshot, now = Date.now()) {
	const url = new URL(
		`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries`,
	);
	url.searchParams.set(
		'filter',
		'metric.type="run.googleapis.com/container/instance_count" AND resource.type="cloud_run_revision"',
	);
	url.searchParams.set(
		'interval.startTime',
		new Date(now - 10 * 60_000).toISOString(),
	);
	url.searchParams.set('interval.endTime', new Date(now).toISOString());
	url.searchParams.set('view', 'FULL');
	const series = await client.list(url.href, 'timeSeries');
	const ceilings = new Map(
		snapshot.functions.map((fn) => [
			fn.serviceConfig.service.split('/').at(-1),
			fn.serviceConfig.maxInstanceCount,
		]),
	);
	const buckets = new Map();
	for (const item of series) {
		const service = item.resource?.labels?.service_name;
		if (!ceilings.has(service)) continue;
		for (const point of item.points ?? []) {
			const minute = Math.floor(
				Date.parse(point.interval.endTime) / 60_000,
			);
			const key = `${service}/${minute}`;
			buckets.set(
				key,
				(buckets.get(key) ?? 0) +
					Number(
						point.value.int64Value ?? point.value.doubleValue ?? 0,
					),
			);
		}
	}
	if (!buckets.size)
		throw new Error('Cloud Run instance monitoring returned no evidence.');
	const newest = Math.max(
		...[...buckets.keys()].map((key) => Number(key.split('/').at(-1))),
	);
	if (now - newest * 60_000 > 300_000)
		throw new Error('Cloud Run instance monitoring is stale.');
	for (const [service, ceiling] of ceilings) {
		for (let minute = newest; minute >= newest - 5; minute--) {
			if (
				Array.from(
					{ length: 5 },
					(_, offset) =>
						buckets.get(`${service}/${minute - offset}`) >= ceiling,
				).every(Boolean)
			)
				throw new Error(
					`${service} remained at its instance ceiling for five minutes.`,
				);
		}
	}
	return {
		checkedAt: new Date(now).toISOString(),
		newestSampleAt: new Date(newest * 60_000).toISOString(),
		instanceMinutes: Object.fromEntries(buckets),
	};
}
