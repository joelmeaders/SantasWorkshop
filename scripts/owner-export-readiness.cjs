const { getToken, requireProject } = require('./remote-config.cjs');

const FUNCTION_ID = 'callableGetOwnerExportUrl';
const REGION = 'us-central1';
const SIGNING_ROLE = 'roles/iam.serviceAccountTokenCreator';

// This checks the supported resource-scoped configuration, not effective IAM.
// Custom roles, inherited grants, conditions, and deny policies need separate review.
const inspectOwnerExportReadiness = async (projectId, request) => {
	requireProject(projectId);
	const functionName = `projects/${projectId}/locations/${REGION}/functions/${FUNCTION_ID}`;
	const fn = await request(
		`https://cloudfunctions.googleapis.com/v2/${functionName}`,
		'export function (cloudfunctions.functions.get)',
	);
	if (fn.name !== functionName || fn.state !== 'ACTIVE')
		throw new Error(
			'The selected project must have an active owner export function.',
		);
	const runtime = fn.serviceConfig?.serviceAccountEmail;
	if (typeof runtime !== 'string' || !runtime.includes('@'))
		throw new Error(
			'The owner export function has no runtime service account.',
		);
	const accountName = `projects/${projectId}/serviceAccounts/${encodeURIComponent(runtime)}`;
	const account = await request(
		`https://iam.googleapis.com/v1/${accountName}`,
		'runtime service account (iam.serviceAccounts.get)',
	);
	if (
		account.email !== runtime ||
		account.projectId !== projectId ||
		account.disabled
	)
		throw new Error(
			'The export runtime must be an enabled service account in the selected project.',
		);
	const project = await request(
		`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
		'project number (resourcemanager.projects.get)',
	);
	if (
		project.projectId !== projectId ||
		!/^\d+$/.test(String(project.projectNumber))
	)
		throw new Error('Cannot verify the selected project number.');
	const api = await request(
		`https://serviceusage.googleapis.com/v1/projects/${project.projectNumber}/services/iamcredentials.googleapis.com`,
		'IAM Credentials API state (serviceusage.services.get)',
	);
	if (api.state !== 'ENABLED')
		throw new Error(
			'The IAM Credentials API must be enabled for owner export signing.',
		);
	const policy = await request(
		`https://iam.googleapis.com/v1/${accountName}:getIamPolicy?options.requestedPolicyVersion=3`,
		'runtime IAM policy (iam.serviceAccounts.getIamPolicy on the runtime service account)',
		'POST',
	);
	const self = `serviceAccount:${runtime}`;
	if (
		!policy.bindings?.some(
			(binding) =>
				binding.role === SIGNING_ROLE &&
				!binding.condition &&
				binding.members?.includes(self),
		)
	)
		throw new Error(
			`Owner export signing does not match the supported configuration: ${runtime} needs an unconditional ${SIGNING_ROLE} binding to itself on its service-account resource. Other grants may provide iam.serviceAccounts.signBlob but are not evaluated by this check.`,
		);
	return {
		projectId,
		runtimeServiceAccount: runtime,
		phase: 'owner-export-signing-configuration-only',
	};
};

const main = async () => {
	if (process.argv.length !== 4 || process.argv[2] !== '--project')
		throw new Error(
			'Usage: node scripts/owner-export-readiness.cjs --project <projectId>',
		);
	const projectId = requireProject(process.argv[3]);
	const token = await getToken();
	const request = async (url, description, method = 'GET') => {
		const response = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				'x-goog-user-project': projectId,
			},
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok)
			throw new Error(
				`Cannot inspect owner export ${description}: HTTP ${response.status}. Readiness is unverified; check the inspection identity's read permissions.`,
			);
		return response.json();
	};
	console.log(
		JSON.stringify(
			await inspectOwnerExportReadiness(projectId, request),
			null,
			2,
		),
	);
};

module.exports = { inspectOwnerExportReadiness };

if (require.main === module) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
