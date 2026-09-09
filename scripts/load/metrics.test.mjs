import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunJournal, arrivals, percentile } from './metrics.mjs';
import { enforceBudget, costCeiling } from './monitor.mjs';
import { CustomerApi } from './customer.mjs';

const journal = () =>
	new RunJournal(
		join(mkdtempSync(join(tmpdir(), 'santashop-load-')), 'events.jsonl'),
	);

test('nearest rank percentiles retain slow tail and incomplete attempts', async () => {
	assert.equal(percentile([], 0.99), null);
	assert.equal(percentile([...Array(98).fill(100), 2500, 3000], 0.99), 2500);
	const log = journal();
	await assert.rejects(
		log.measure('phase', 'call', async () => {
			throw new Error('failure');
		}),
	);
	assert.equal(log.summary()[0].attempts, 1);
	assert.equal(log.summary()[0].successful, 0);
	assert.equal(log.summary()[0].unexpectedErrors, 1);
	assert.match(log.stopReason, /1%/);
	assert.ok(readFileSync(log.path, 'utf8').includes('request'));
});

test('expected aborts and duplicate rejections remain visible without stopping arrivals', async () => {
	const log = journal();
	for (const code of ['AbortError', 'ALREADY_EXISTS']) {
		await assert.rejects(
			log.measure(
				'fault',
				'call',
				async () => {
					const error = new Error();
					error.name = code;
					throw error;
				},
				[code],
			),
		);
	}
	assert.equal(log.stopReason, undefined);
	assert.equal(log.summary()[0].unexpectedErrors, 0);
});

test('open-loop arrivals launch before preceding journeys finish', async () => {
	const log = journal();
	let active = 0;
	let peak = 0;
	await arrivals(log, 'phase', 4, 400, async () => {
		peak = Math.max(peak, ++active);
		await new Promise((resolve) => setTimeout(resolve, 450));
		active--;
	});
	assert.ok(peak > 1);
	assert.equal(
		log.events.filter((e) => e.type === 'journey-attempt').length,
		4,
	);
	assert.equal(
		log.events.filter((e) => e.type === 'journey-complete').length,
		4,
	);
});

test('in-flight ceiling stops without silently lowering traffic', async () => {
	const log = journal();
	await assert.rejects(
		arrivals(
			log,
			'phase',
			3,
			20,
			async () => new Promise((resolve) => setTimeout(resolve, 40)),
			{ maxInFlight: 1 },
		),
	);
	assert.match(log.stopReason, /target/);
	assert.equal(
		log.events.filter((e) => e.type === 'journey-attempt').length,
		1,
	);
});

test('expired isolation proof stops new calls before network access', async () => {
	const log = journal();
	log.isolationExpiresAt = Date.now() - 1;
	const api = new CustomerApi(
		{
			projectId: 'santas-workshop-test',
			apiKey: 'key',
			appId: '1:123:web:abc',
			storageBucket: 'santas-workshop-test.appspot.com',
			customerOrigin: 'https://test.denversantaclausshop.org',
			adminOrigin: 'https://santas-workshop-test.web.app',
		},
		() => {
			throw new Error('Must not request a token');
		},
		log,
	);
	await assert.rejects(api.call('phase', 'newAccount', {}), /proof expired/);
});

test('budget has no free-tier credits and blocks missing limits or exhausted reserve', () => {
	assert.throws(
		() => costCeiling({ functions: [{ serviceConfig: {} }] }, 0),
		/missing/,
	);
	const cost = costCeiling(
		{
			functions: [
				{
					serviceConfig: {
						availableCpu: '1',
						availableMemory: '256M',
						maxInstanceCount: 5,
					},
				},
			],
		},
		120,
		3600,
	);
	assert.ok(cost.projectedCeilingUsd > cost.elapsedCeilingUsd);
	assert.equal(cost.actualBilledUsd, null);
	assert.throws(() => enforceBudget({ elapsedCeilingUsd: 20 }), /\$20/);
	assert.throws(
		() =>
			enforceBudget(
				{ elapsedCeilingUsd: 6, projectedCeilingUsd: 20 },
				true,
			),
		/\$20/,
	);
});
