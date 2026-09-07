const { getToken, requireProject } = require('./remote-config.cjs');
const { getModePrefix, FUNCTION_PROJECT_IDS } = require('../config.functions.cjs');

const GATEWAY_FUNCTION = 'publicParametersGateway';
const REGION = 'us-central1';
const GATEWAY_CONSUMERS = ['completeRegistration', 'saveDraftChild', 'deleteDraftChild', 'setDraftAppointment', 'undoRegistration', 'changeRegistrationDateTime'];
const gatewayReader = (projectId, env = process.env) => {
	const prefix = getModePrefix(projectId === FUNCTION_PROJECT_IDS.test ? 'test' : 'prod');
	return env[`${prefix}_SANTASHOP_REMOTE_CONFIG_READER_SERVICE_ACCOUNT`] || `remote-config-reader@${projectId}.iam.gserviceaccount.com`;
};

const assessGateway = (projectId, fn, policy, env = process.env, service) => {
	requireProject(projectId);
	const problems = [];
	const expectedName = `projects/${projectId}/locations/${REGION}/functions/${GATEWAY_FUNCTION}`;
	if (fn.name !== expectedName || fn.state !== 'ACTIVE') problems.push('The settings gateway must be ACTIVE in the exact target project.');
	const config = fn.serviceConfig ?? {};
	if (config.maxInstanceCount !== 1 || config.maxInstanceRequestConcurrency !== 80) problems.push('Settings gateway requires maxInstanceCount=1 and concurrency=80.');
	if (config.serviceAccountEmail !== gatewayReader(projectId, env)) problems.push('Settings gateway runtime identity does not match the configured reader.');
	let url;
	try {
		url = new URL(config.uri);
		if (url.protocol !== 'https:' || !url.hostname.endsWith('.run.app') || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) throw new Error();
	} catch { problems.push('Settings gateway requires the canonical HTTPS Cloud Run URI.'); }
	const invoker = `serviceAccount:${gatewayReader(projectId, env)}`;
	const bindings = policy.bindings ?? [];
	if (!bindings.some(binding => binding.role === 'roles/run.invoker' && !binding.condition && binding.members?.includes(invoker))) problems.push('Settings gateway must grant its reader service account unconditional Run Invoker.');
	if (bindings.some(binding => binding.members?.some(member => member === 'allUsers' || member === 'allAuthenticatedUsers'))) problems.push('Settings gateway must not have a public IAM binding.');
	if (bindings.some(binding => binding.role === 'roles/run.invoker' && binding.members?.some(member => member !== invoker))) problems.push('Settings gateway has an unexpected invoker; review access before release.');
	if (!service || service.name !== config.service || service.uri !== config.uri) problems.push('The live Cloud Run service must match the discovered gateway.');
	if (service) {
		if (service.invokerIamDisabled === true) problems.push('Settings gateway IAM permission checks are disabled.');
		if (service.defaultUriDisabled === true) problems.push('Settings gateway canonical URI is disabled.');
		if (service.reconciling === true || service.terminalCondition?.state !== 'CONDITION_SUCCEEDED') problems.push('The gateway Cloud Run service has not reached a ready state.');
		if (service.template?.scaling?.maxInstanceCount !== 1 || service.template?.maxInstanceRequestConcurrency !== 80 || service.template?.serviceAccount !== gatewayReader(projectId, env)) problems.push('Live gateway revision settings do not match the singleton reader contract.');
		const traffic = service.traffic ?? [];
		if (traffic.length && (traffic.length !== 1 || traffic[0].percent !== 100 || traffic[0].tag || (traffic[0].type !== 'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST' && traffic[0].revision !== service.latestReadyRevision))) problems.push('Settings gateway traffic must target only the latest ready revision without extra tagged revisions.');
	}
	return { projectId, gatewayUri: url?.origin, problems };
};

const inspectGateway = async (projectId, env = process.env, verifyConsumers = false) => {
	requireProject(projectId);
	const headers = { Authorization: `Bearer ${await getToken()}`, 'x-goog-user-project': projectId };
	const read = async (url) => {
		const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
		if (!response.ok) throw new Error(`Settings gateway inspection failed: HTTP ${response.status} from ${new URL(url).hostname}.`);
		return response.json();
	};
	const fn = await read(`https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${REGION}/functions/${GATEWAY_FUNCTION}`);
	const service = fn.serviceConfig?.service;
	const expectedPrefix = `projects/${projectId}/locations/${REGION}/services/`;
	if (typeof service !== 'string' || !service.startsWith(expectedPrefix) || !/^[a-z][a-z0-9-]*$/.test(service.slice(expectedPrefix.length))) throw new Error('Gateway service does not belong to the target project and region.');
	const [policy, liveService] = await Promise.all([
		read(`https://run.googleapis.com/v2/${service}:getIamPolicy`),
		read(`https://run.googleapis.com/v2/${service}`),
	]);
	const result = assessGateway(projectId, fn, policy, env, liveService);
	if (verifyConsumers) {
		const consumers = await Promise.all(GATEWAY_CONSUMERS.map(id => read(`https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${REGION}/functions/${id}`)));
		result.problems.push(...assessConsumers(projectId, consumers, result.gatewayUri, env));
	}
	return result;
};

const assessConsumers = (projectId, functions, gatewayUri, env = process.env) => GATEWAY_CONSUMERS.flatMap(id => {
	const expectedName = `projects/${projectId}/locations/${REGION}/functions/${id}`;
	const fn = functions.find(item => item.name === expectedName);
	return !fn || fn.state !== 'ACTIVE' || fn.serviceConfig?.serviceAccountEmail !== gatewayReader(projectId, env) || !gatewayUri || fn.serviceConfig?.environmentVariables?.SANTASHOP_REMOTE_CONFIG_GATEWAY_URL !== gatewayUri
		? [`Consumer ${id} is not ACTIVE with the exact gateway URI and reader identity.`] : [];
});

module.exports = { GATEWAY_FUNCTION, GATEWAY_CONSUMERS, REGION, gatewayReader, assessGateway, assessConsumers, inspectGateway };
