import { appendFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

export const percentile = (values, fraction) => {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
};

export class RunJournal {
	constructor(path) {
		this.path = path;
		this.events = [];
		this.stopReason = undefined;
	}
	record(event) {
		const entry = { at: new Date().toISOString(), ...event };
		// Write before proceeding. Never put passwords, tokens, request bodies, or URLs here.
		appendFileSync(this.path, `${JSON.stringify(entry)}\n`, {
			mode: 0o600,
		});
		this.events.push(entry);
		return entry;
	}
	stop(reason) {
		if (!this.stopReason) {
			this.stopReason = reason;
			this.record({ type: 'stop', reason });
		}
	}
	assertRunning() {
		if (this.isolationExpiresAt && Date.now() >= this.isolationExpiresAt)
			this.stop('The live isolation proof expired.');
		if (this.stopReason) throw new Error(this.stopReason);
	}
	async measure(phase, operation, work, expectedCodes = []) {
		const started = performance.now();
		try {
			const result = await work();
			this.record({
				type: 'request',
				phase,
				operation,
				durationMs: performance.now() - started,
				ok: true,
			});
			return result;
		} catch (error) {
			const expected = expectedCodes.includes(error.code ?? error.name);
			this.record({
				type: 'request',
				phase,
				operation,
				durationMs: performance.now() - started,
				ok: false,
				expected,
				code: error.code ?? error.name,
			});
			const recent = this.events.filter(
				(e) =>
					e.type === 'request' &&
					Date.parse(e.at) > Date.now() - 60_000,
			);
			if (
				recent.filter((e) => !e.ok && !e.expected).length /
					recent.length >
				0.01
			)
				this.stop(
					'Unexpected errors exceeded 1% in the rolling minute.',
				);
			throw error;
		}
	}
	summary() {
		const groups = new Map();
		for (const event of this.events.filter((e) => e.type === 'request')) {
			const key = `${event.phase}/${event.operation}`;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(event);
		}
		return [...groups].map(([operation, events]) => ({
			operation,
			attempts: events.length,
			successful: events.filter((e) => e.ok).length,
			unexpectedErrors: events.filter((e) => !e.ok && !e.expected).length,
			p50Ms: percentile(
				events.map((e) => e.durationMs),
				0.5,
			),
			p95Ms: percentile(
				events.map((e) => e.durationMs),
				0.95,
			),
			p99Ms: percentile(
				events.map((e) => e.durationMs),
				0.99,
			),
			underTwoSecondsFraction:
				events.filter((e) => e.durationMs < 2000).length /
				events.length,
		}));
	}
}

export const delay = (ms) =>
	new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** Open-loop arrivals: slow responses do not reduce offered traffic. Never catch up a late generator. */
export async function arrivals(
	journal,
	phase,
	count,
	durationMs,
	work,
	{ maxInFlight = 100, maxLagMs = 250 } = {},
) {
	const start = performance.now();
	const pending = new Set();
	let failure;
	journal.record({ type: 'phase-start', phase, count, durationMs });
	for (let index = 0; index < count && !journal.stopReason; index++) {
		const due = start + (index * durationMs) / count;
		await delay(due - performance.now());
		if (journal.stopReason) break;
		const lagMs = performance.now() - due;
		if (lagMs > maxLagMs || pending.size >= maxInFlight) {
			journal.stop('Load generator missed the arrival target.');
			break;
		}
		journal.record({ type: 'journey-attempt', phase, index, lagMs });
		const task = Promise.resolve()
			.then(() => work(index))
			.then(() => {
				journal.record({ type: 'journey-complete', phase, index });
			})
			.catch((error) => {
				failure ??= error;
				journal.stop(
					`Journey failed in ${phase}: ${error.code ?? error.name}.`,
				);
			})
			.finally(() => pending.delete(task));
		pending.add(task);
	}
	await Promise.allSettled(pending);
	while (!journal.stopReason && performance.now() < start + durationMs)
		await delay(Math.min(1000, start + durationMs - performance.now()));
	journal.record({ type: 'phase-end', phase });
	if (failure) throw failure;
	journal.assertRunning();
}
