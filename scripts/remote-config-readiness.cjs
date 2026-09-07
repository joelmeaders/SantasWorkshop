const { getToken, requireProject, fetchSnapshot } = require('./remote-config.cjs');
const { verifyPublicParameters } = require('./verify-public-parameters.cjs');
const { FUNCTION_PROJECT_IDS, getModePrefix, loadLocalEnvFiles } = require('../config.functions.cjs');

// Six deployments permit 50 instances in total. A busy instance refreshes six
// times/minute. Reserve another 300 reads for cold starts and operator traffic.
const REQUIRED_TEMPLATE_READS_PER_MINUTE = 600;
const runtimeRoles = ['roles/cloudconfig.viewer', 'roles/datastore.user', 'roles/logging.logWriter'];

const assessReadiness = (projectId, metrics, policy, bucketPolicy, env = process.env) => {
	requireProject(projectId);
	const problems = [];
	const metric = metrics.metrics?.find((item) => item.metric === 'firebaseremoteconfig.googleapis.com/read_requests');
	const limit = metric?.consumerQuotaLimits?.find((item) => item.unit === '1/min/{project}');
	const quota = Number(limit?.quotaBuckets?.find((bucket) => !bucket.dimensions || Object.keys(bucket.dimensions).length === 0)?.effectiveLimit);
	if (!Number.isFinite(quota) || quota < REQUIRED_TEMPLATE_READS_PER_MINUTE) problems.push(`Template-read quota is ${Number.isFinite(quota) ? quota : 'unknown'}/minute; at least ${REQUIRED_TEMPLATE_READS_PER_MINUTE}/minute is required before release.`);
	const prefix = getModePrefix(projectId === FUNCTION_PROJECT_IDS.test ? 'test' : 'prod');
	const reader = `serviceAccount:${env[`${prefix}_SANTASHOP_REMOTE_CONFIG_READER_SERVICE_ACCOUNT`] || `remote-config-reader@${projectId}.iam.gserviceaccount.com`}`;
	const publisher = `serviceAccount:${env[`${prefix}_SANTASHOP_REMOTE_CONFIG_PUBLISHER_SERVICE_ACCOUNT`] || `remote-config-publisher@${projectId}.iam.gserviceaccount.com`}`;
	const rolesFor = (member) => (policy.bindings ?? []).filter((binding) => !binding.condition && binding.members?.includes(member)).map((binding) => binding.role);
	const readerRoles = rolesFor(reader);
	const publisherRoles = rolesFor(publisher);
	for (const role of runtimeRoles) if (!readerRoles.includes(role)) problems.push(`Reader account requires ${role}.`);
	// Conditional grants cannot prove required access, but still grant permissions
	// in some circumstances and must count when checking excess privileges.
	if ((policy.bindings ?? []).some((binding) => binding.members?.includes(reader) && !runtimeRoles.includes(binding.role))) problems.push('Reader account has unexpected project roles; review its permissions before release.');
	for (const role of ['roles/cloudconfig.admin', 'roles/logging.logWriter']) if (!publisherRoles.includes(role)) problems.push(`Publisher account requires ${role}.`);
	// This gate does not evaluate CEL conditions. Require an unconditional grant
	// rather than accepting a condition that might exclude registrations objects.
	const storageBinding = bucketPolicy.bindings?.find((binding) => !binding.condition && binding.role === 'roles/storage.objectUser' && binding.members?.includes(reader));
	if (!storageBinding) problems.push('Reader account requires unconditional Storage Object User on the QR bucket for cancellation QR replacement; this gate cannot verify conditional access.');
	return { projectId, templateReadsPerMinute: quota, requiredTemplateReadsPerMinute: REQUIRED_TEMPLATE_READS_PER_MINUTE, problems };
};

const main = async () => {
	if (process.argv.length !== 4 || process.argv[2] !== '--project') throw new Error('Usage: node scripts/remote-config-readiness.cjs --project <projectId>');
	const projectId = requireProject(process.argv[3]);
	loadLocalEnvFiles();
	const headers = { Authorization: `Bearer ${await getToken()}`, 'x-goog-user-project': projectId, 'Content-Type': 'application/json' };
	const request = async (url, options = {}) => {
		const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000), ...options });
		if (!response.ok) throw new Error(`Readiness inspection failed: HTTP ${response.status} from ${new URL(url).hostname}.`);
		return response.json();
	};
	const [metrics, policy, bucketPolicy, snapshot] = await Promise.all([
		request(`https://serviceusage.googleapis.com/v1beta1/projects/${projectId}/services/firebaseremoteconfig.googleapis.com/consumerQuotaMetrics?view=FULL`),
		request(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`, { method: 'POST', body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }) }),
		request(`https://storage.googleapis.com/storage/v1/b/${projectId}.appspot.com/iam?optionsRequestedPolicyVersion=3`),
		fetchSnapshot(projectId),
	]);
	const result = assessReadiness(projectId, metrics, policy, bucketPolicy);
	try { verifyPublicParameters(snapshot); } catch (error) { result.problems.push(error.message); }
	console.log(JSON.stringify(result, null, 2));
	if (result.problems.length) process.exitCode = 1;
};

module.exports = { assessReadiness, REQUIRED_TEMPLATE_READS_PER_MINUTE };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
