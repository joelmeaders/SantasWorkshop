import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT, assertProject } from './config.mjs';
import { GoogleClient } from './google.mjs';

const METRICS = {
	cpu: 'container/cpu/utilizations',
	memory: 'container/memory/utilizations',
	startup: 'container/startup_latencies',
	concurrency: 'container/max_request_concurrencies',
	latency: 'request_latencies',
	requests: 'request_count',
};
export const METRIC_SETTLE_MS = 180_000;

function bucketUpper(options, index) {
	if (options.linearBuckets) {
		const { numFiniteBuckets, width, offset = 0 } = options.linearBuckets;
		return index <= numFiniteBuckets ? offset + index * width : Infinity;
	}
	if (options.exponentialBuckets) {
		const { numFiniteBuckets, growthFactor, scale } =
			options.exponentialBuckets;
		return index <= numFiniteBuckets
			? scale * growthFactor ** index
			: Infinity;
	}
	if (options.explicitBuckets)
		return options.explicitBuckets.bounds[index] ?? Infinity;
	throw new Error('Resource metric has an unknown histogram format.');
}

/** Percentiles and peaks are histogram upper bounds, not exact sample values. */
export function summarizeDistribution(series) {
	let samples = 0;
	let total = 0;
	const buckets = [];
	for (const item of series)
		for (const point of item.points ?? []) {
			const value = point.value?.distributionValue;
			const count = Number(value?.count ?? 0);
			if (!count) continue;
			const counts = (value.bucketCounts ?? []).map(Number);
			if (counts.reduce((sum, n) => sum + n, 0) !== count)
				throw new Error(
					'Resource histogram sample counts do not match.',
				);
			samples += count;
			total += count * Number(value.mean ?? 0);
			for (let index = 0; index < counts.length; index++) {
				if (counts[index])
					buckets.push({
						count: counts[index],
						upper: bucketUpper(value.bucketOptions, index),
					});
			}
		}
	if (!samples) return null;
	buckets.sort((a, b) => a.upper - b.upper);
	const percentile = (fraction) => {
		let count = 0;
		for (const bucket of buckets) {
			count += bucket.count;
			if (count >= Math.ceil(samples * fraction)) return bucket.upper;
		}
		throw new Error('Resource percentile could not be determined.');
	};
	const finite = (value) => (Number.isFinite(value) ? value : null);
	return {
		samples,
		mean: total / samples,
		p95UpperBound: finite(percentile(0.95)),
		p99UpperBound: finite(percentile(0.99)),
		peakUpperBound: finite(buckets.at(-1).upper),
		overflow: !Number.isFinite(buckets.at(-1).upper),
	};
}

function memoryMiB(value) {
	const match = /^(\d+)(Mi|M|Gi|G)$/.exec(value ?? '');
	if (!match) throw new Error('Unknown deployed memory limit.');
	return Number(match[1]) * (match[2].startsWith('G') ? 1024 : 1);
}

export function assessResourceEvidence(
	functions,
	metrics,
	errors,
	requiredFunctions = [],
) {
	const rows = functions.map((fn) => {
		const revision = fn.serviceConfig.revision.split('/').at(-1);
		const selected = (key) =>
			(metrics[key] ?? []).filter(
				(series) => series.resource.labels.revision_name === revision,
			);
		const requestsByCode = {};
		for (const series of selected('requests')) {
			const code = series.metric.labels.response_code;
			requestsByCode[code] =
				(requestsByCode[code] ?? 0) +
				series.points.reduce(
					(sum, point) => sum + Number(point.value.int64Value ?? 0),
					0,
				);
		}
		const failures = errors.filter((entry) => entry.revision === revision);
		const memory = summarizeDistribution(selected('memory'));
		const cpu = summarizeDistribution(selected('cpu'));
		const requestCount = Object.values(requestsByCode).reduce(
			(sum, count) => sum + count,
			0,
		);
		const problems = [];
		if (
			!(Number(fn.serviceConfig.availableCpu) > 0) ||
			!(fn.serviceConfig.maxInstanceRequestConcurrency > 0) ||
			!(fn.serviceConfig.maxInstanceCount > 0)
		)
			problems.push(
				'Deployed CPU, concurrency, or instance limit is missing.',
			);
		if (failures.some((entry) => entry.kind === 'out-of-memory'))
			problems.push('Out-of-memory termination.');
		if (failures.some((entry) => entry.kind === 'deadline'))
			problems.push('Request deadline exceeded.');
		if (
			Object.entries(requestsByCode).some(
				([code, count]) => Number(code) >= 500 && count > 0,
			)
		)
			problems.push('HTTP 5xx responses occurred.');
		if (
			memory &&
			(memory.overflow || memory.peakUpperBound > 0.8 + Number.EPSILON)
		)
			problems.push('Observed memory headroom is below 20%.');
		if (
			cpu &&
			(cpu.p95UpperBound === null ||
				cpu.p95UpperBound > 0.8 + Number.EPSILON)
		)
			problems.push('Observed CPU p95 exceeds 80% utilization.');
		if (!requestCount || !memory || !cpu)
			problems.push('Request, CPU, or memory evidence is missing.');
		return {
			name: fn.name.split('/').at(-1),
			service: fn.serviceConfig.service.split('/').at(-1),
			revision,
			memoryMiB: memoryMiB(fn.serviceConfig.availableMemory),
			cpuLimit: Number(fn.serviceConfig.availableCpu),
			concurrencyLimit: fn.serviceConfig.maxInstanceRequestConcurrency,
			maxInstances: fn.serviceConfig.maxInstanceCount,
			timeoutSeconds: fn.serviceConfig.timeoutSeconds,
			requestCount,
			requestsByCode,
			memory,
			cpu,
			startupMs: summarizeDistribution(selected('startup')),
			requestLatencyMs: summarizeDistribution(selected('latency')),
			concurrency: summarizeDistribution(selected('concurrency')),
			outOfMemoryEvents: failures.filter(
				(entry) => entry.kind === 'out-of-memory',
			).length,
			problems,
			status:
				!requestCount && !failures.length
					? 'unmeasured'
					: problems.length
						? 'needs-attention'
						: 'observed-headroom',
		};
	});
	const byName = new Map(rows.map((row) => [row.name, row]));
	const problems = requiredFunctions.flatMap((name) => {
		const row = byName.get(name);
		return row
			? row.problems.map((problem) => `${name}: ${problem}`)
			: [`${name}: deployed function is missing.`];
	});
	return {
		passed: requiredFunctions.length ? !problems.length : null,
		requiredFunctions,
		problems,
		functions: rows,
		limits: 'Observed workload only. Unexercised functions and configured peak concurrency are not validated.',
	};
}

export async function collectResourceEvidence(
	client,
	functions,
	{ startTime, endTime, requiredFunctions = [] },
) {
	assertProject(client.project);
	const start = Date.parse(startTime);
	const end = Date.parse(endTime);
	if (
		!Number.isFinite(start) ||
		!Number.isFinite(end) ||
		end <= start ||
		end - start > 86_400_000
	)
		throw new Error(
			'Resource observation window must be valid and at most 24 hours.',
		);
	const metrics = Object.fromEntries(
		await Promise.all(
			Object.entries(METRICS).map(async ([key, suffix]) => {
				const url = new URL(
					`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries`,
				);
				url.searchParams.set(
					'filter',
					`metric.type="run.googleapis.com/${suffix}" AND resource.type="cloud_run_revision"${key === 'concurrency' ? ' AND metric.labels.state="active"' : ''}`,
				);
				url.searchParams.set(
					'interval.startTime',
					new Date(start).toISOString(),
				);
				url.searchParams.set(
					'interval.endTime',
					new Date(end).toISOString(),
				);
				url.searchParams.set('view', 'FULL');
				return [key, await client.list(url.href, 'timeSeries')];
			}),
		),
	);
	const errors = [];
	let pageToken;
	do {
		const page = await client.request(
			'https://logging.googleapis.com/v2/entries:list',
			{
				method: 'POST',
				body: {
					resourceNames: [`projects/${PROJECT}`],
					filter: `resource.type="cloud_run_revision" AND timestamp>="${new Date(start).toISOString()}" AND timestamp<="${new Date(end).toISOString()}" AND (textPayload:"Memory limit" OR httpRequest.status=504)`,
					orderBy: 'timestamp desc',
					pageSize: 1000,
					...(pageToken ? { pageToken } : {}),
				},
			},
		);
		errors.push(
			...(page.entries ?? []).map((entry) => ({
				timestamp: entry.timestamp,
				revision: entry.resource.labels.revision_name,
				kind:
					entry.httpRequest?.status === 504
						? 'deadline'
						: 'out-of-memory',
			})),
		);
		pageToken = page.nextPageToken;
		if (pageToken && errors.length >= 5000)
			throw new Error(
				'Resource failure inventory exceeded its bounded read limit.',
			);
	} while (pageToken);
	const assessment = assessResourceEvidence(
		functions,
		metrics,
		errors,
		requiredFunctions,
	);
	const metricsSettled = Date.now() >= end + METRIC_SETTLE_MS;
	if (!metricsSettled && requiredFunctions.length) {
		assessment.passed = false;
		assessment.problems.push(
			'Resource metrics have not passed the sampling and ingestion window.',
		);
	}
	return {
		project: PROJECT,
		collectedAt: new Date().toISOString(),
		startTime: new Date(start).toISOString(),
		endTime: new Date(end).toISOString(),
		metricsSettled,
		...assessment,
	};
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const option = (name) => {
		const index = process.argv.indexOf(name);
		return index < 0 ? undefined : process.argv[index + 1];
	};
	assertProject(option('--project'));
	const client = new GoogleClient(PROJECT);
	const functions = await client.list(
		`https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/-/functions`,
		'functions',
	);
	const report = await collectResourceEvidence(client, functions, {
		startTime: option('--start'),
		endTime: option('--end'),
		requiredFunctions: option('--functions')?.split(',') ?? [],
	});
	if (option('--output'))
		writeFileSync(
			resolve(option('--output')),
			JSON.stringify(report, null, 2),
		);
	console.log(JSON.stringify(report, null, 2));
	if (report.passed === false) process.exitCode = 1;
}
