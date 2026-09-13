import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { deploy } = require('./remote-config-deploy.cjs');
for (const [functions, rules, expected] of [
	['true', 'false', ['functions:publicParametersGateway', 'functions']],
	['false', 'true', ['firestore:rules,firestore:indexes,storage']],
	[
		'true',
		'true',
		[
			'functions:publicParametersGateway',
			'functions',
			'firestore:rules,firestore:indexes,storage',
		],
	],
])
	test(`deployment selection functions=${functions} rules=${rules}`, async () => {
		const previous = process.argv[2];
		process.argv[2] = 'test';
		const calls = [];
		try {
			await deploy(
				{
					GITHUB_ACTIONS: 'true',
					SANTASHOP_FUNCTIONS_DEPLOY: 'test',
					SANTASHOP_DEPLOY_FUNCTIONS: functions,
					SANTASHOP_DEPLOY_RULES: rules,
				},
				(command, args) => calls.push({ command, args }),
				async () => ({
					problems: [],
					gatewayUri: 'https://example.invalid',
				}),
			);
			const deployments = calls.filter((call) =>
				call.args.includes('deploy'),
			);
			assert.deepEqual(
				deployments.map(
					(call) => call.args[call.args.indexOf('--only') + 1],
				),
				expected,
			);
			if (functions === 'false')
				assert.equal(
					calls.length,
					1,
					'rules-only deployment must not configure or redeploy Functions',
				);
		} finally {
			process.argv[2] = previous;
		}
	});
test('empty or invalid deployment selection stops before all external commands', async () => {
	const previous = process.argv[2];
	process.argv[2] = 'test';
	try {
		for (const values of [
			['false', 'false'],
			['unexpected', 'true'],
		]) {
			let calls = 0;
			await assert.rejects(
				deploy(
					{
						GITHUB_ACTIONS: 'true',
						SANTASHOP_FUNCTIONS_DEPLOY: 'test',
						SANTASHOP_DEPLOY_FUNCTIONS: values[0],
						SANTASHOP_DEPLOY_RULES: values[1],
					},
					() => calls++,
				),
			);
			assert.equal(calls, 0);
		}
	} finally {
		process.argv[2] = previous;
	}
});
