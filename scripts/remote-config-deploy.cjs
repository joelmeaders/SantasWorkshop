const { execFileSync } = require('node:child_process');
const { assertFunctionsDeployFromCi } = require('./assert-functions-deploy-ci.cjs');
const { FUNCTION_PROJECT_IDS, getModePrefix } = require('../config.functions.cjs');
const { inspectGateway, GATEWAY_FUNCTION } = require('./remote-config-gateway.cjs');

// Functions deployments remain CI-only. Bootstrap the private reader first so
// callers receive its verified canonical URI and use that URI as token audience.
const deploy = async (env = process.env, run = execFileSync, inspect = inspectGateway) => {
	const mode = assertFunctionsDeployFromCi(env);
	if (process.argv[2] !== mode) throw new Error('Release argument must match SANTASHOP_FUNCTIONS_DEPLOY.');
	const projectId = FUNCTION_PROJECT_IDS[mode];
	const options = { cwd: require('node:path').resolve(__dirname, '..'), env, stdio: 'inherit' };
	const node = (args) => run(process.execPath, args, options);
	const firebase = (args) => run('pnpm', ['exec', 'firebase', ...args], options);
	node(['scripts/remote-config-readiness.cjs', '--project', projectId, '--preflight']);
	node(['scripts/remote-config.cjs', 'release-defaults', '--project', projectId]);
	node(['config.functions.cjs', mode]);
	const base = ['deploy', '--config', 'firebase.functions-deploy.json', '--project', projectId];
	firebase([...base, '--only', `functions:${GATEWAY_FUNCTION}`, '--force']);
	let gateway;
	for (let attempt = 0; attempt < 12; attempt++) {
		try {
			gateway = await inspect(projectId, env);
			if (!gateway.problems.length) break;
		} catch (error) { gateway = { problems: [error.message] }; }
		if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 10_000));
	}
	if (!gateway || gateway.problems.length || !gateway.gatewayUri) throw new Error(`Private gateway deployment is not ready: ${gateway?.problems.join(' ')}`);
	env[`${getModePrefix(mode)}_SANTASHOP_REMOTE_CONFIG_GATEWAY_URL`] = gateway.gatewayUri;
	node(['config.functions.cjs', mode]);
	node(['scripts/remote-config-readiness.cjs', '--project', projectId]);
	firebase([...base, '--only', 'functions', '--force']);
	node(['scripts/remote-config-readiness.cjs', '--project', projectId, '--consumers']);
	firebase(['deploy', '--project', projectId, '--only', mode === 'prod' ? 'firestore:rules,firestore:indexes,storage,database' : 'firestore:rules,firestore:indexes,storage', '--force']);
};

module.exports = { deploy };
if (require.main === module) deploy().catch(error => { console.error(error.message); process.exitCode = 1; });
