import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessResourceEvidence, summarizeDistribution } from './resources.mjs';

function series(value, revision = 'counter-new', code) {
	return {
		resource: { labels: { revision_name: revision } },
		metric: { labels: code ? { response_code: code } : {} },
		points: [{ value }],
	};
}
const histogram = (
	counts,
	options = { linearBuckets: { numFiniteBuckets: 10, width: 0.1 } },
	mean,
) => ({
	distributionValue: {
		count: counts.reduce((sum, n) => sum + n, 0),
		bucketCounts: counts,
		bucketOptions: options,
		...(mean === undefined ? {} : { mean }),
	},
});
function fixture() {
	const fn = {
		name: 'projects/santas-workshop-test/locations/us-central1/functions/counter',
		serviceConfig: {
			revision: 'counter-new',
			service:
				'projects/santas-workshop-test/locations/us-central1/services/counter',
			availableMemory: '256Mi',
			availableCpu: '0.1666',
			maxInstanceRequestConcurrency: 1,
			maxInstanceCount: 1,
			timeoutSeconds: 30,
		},
	};
	return {
		functions: [fn],
		metrics: {
			requests: [series({ int64Value: '3' }, 'counter-new', '200')],
			memory: [series(histogram([0, 0, 0, 0, 0, 0, 3], undefined, 0.55))],
			cpu: [series(histogram([1, 2]))],
		},
	};
}

test('resource histograms preserve unknown coverage and zero protobuf defaults', () => {
	assert.equal(summarizeDistribution([series(histogram([]))]), null);
	const result = summarizeDistribution([series(histogram([1, 2]))]);
	assert.equal(result.mean, 0);
	assert.equal(result.samples, 3);
	assert.equal(result.p95UpperBound, 0.1);
	assert.throws(
		() =>
			summarizeDistribution([
				series({ distributionValue: { count: 5, bucketCounts: [1] } }),
			]),
		/counts do not match/,
	);
});

test('resource percentiles combine samples and retain overflow instead of inventing a peak', () => {
	const options = { explicitBuckets: { bounds: [0, 0.5, 0.8, 1] } };
	const result = summarizeDistribution([
		series(histogram([0, 95, 0, 0, 0], options, 0.25)),
		series(histogram([0, 0, 0, 0, 5], options, 1.1)),
	]);
	assert.equal(result.p95UpperBound, 0.5);
	assert.equal(result.p99UpperBound, null);
	assert.equal(result.peakUpperBound, null);
	assert.equal(result.overflow, true);
	assert.equal(result.samples, 100);
});

test('startup exponential buckets remain upper bounds', () => {
	const result = summarizeDistribution([
		series(
			histogram(
				[0, 0, 1],
				{
					exponentialBuckets: {
						numFiniteBuckets: 3,
						scale: 10,
						growthFactor: 2,
					},
				},
				35,
			),
		),
	]);
	assert.equal(result.peakUpperBound, 40);
});

test('resource assessment excludes retired revisions but fails current OOM even with low samples', () => {
	const { functions, metrics } = fixture();
	const oldFailure = { revision: 'counter-old', kind: 'out-of-memory' };
	metrics.requests.push(series({ int64Value: '100' }, 'counter-old', '500'));
	assert.equal(
		assessResourceEvidence(functions, metrics, [oldFailure], ['counter'])
			.passed,
		true,
	);
	const result = assessResourceEvidence(
		functions,
		metrics,
		[{ revision: 'counter-new', kind: 'out-of-memory' }],
		['counter'],
	);
	assert.equal(result.passed, false);
	assert.ok(
		result.problems.some((problem) => problem.includes('Out-of-memory')),
	);
	assert.equal(result.functions[0].requestCount, 3);
});

test('resource assessment fails insufficient headroom and never passes missing evidence', () => {
	const { functions, metrics } = fixture();
	metrics.memory = [series(histogram([0, 0, 0, 0, 0, 0, 0, 0, 0, 3]))];
	assert.equal(
		assessResourceEvidence(functions, metrics, [], ['counter']).passed,
		false,
	);
	const missing = assessResourceEvidence(functions, {}, [], ['counter']);
	assert.equal(missing.passed, false);
	assert.equal(missing.functions[0].status, 'unmeasured');
	assert.equal(missing.functions[0].memory, null);
	assert.equal(assessResourceEvidence(functions, {}, []).passed, null);
});
