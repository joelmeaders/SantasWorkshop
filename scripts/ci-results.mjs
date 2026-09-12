export function requireSelectedChecks(needs) {
	if (needs.targets?.result !== 'success')
		throw new Error('Change detection did not succeed.');
	for (const job of ['tooling', 'shared', 'ui', 'functions', 'e2e']) {
		const selected = needs.targets.outputs[job];
		if (!['true', 'false'].includes(selected))
			throw new Error(`Missing selection for ${job}.`);
		const expected = selected === 'true' ? 'success' : 'skipped';
		if (needs[job]?.result !== expected)
			throw new Error(
				`${job} must be ${expected}, received ${needs[job]?.result}.`,
			);
	}
}
if (process.env.NEEDS_JSON)
	requireSelectedChecks(JSON.parse(process.env.NEEDS_JSON));
