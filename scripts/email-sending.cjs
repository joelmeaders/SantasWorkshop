const {
	fetchSnapshot,
	getToken,
	requireProject,
} = require('./remote-config.cjs');
const EMAIL_SENDING_PARAMETER = 'santashop_email_sending_enabled';

const parameterLocations = (template) =>
	[
		template.parameters ?? {},
		...Object.values(template.parameterGroups ?? {}).map(
			(group) => group.parameters ?? {},
		),
	].filter((parameters) =>
		Object.hasOwn(parameters, EMAIL_SENDING_PARAMETER),
	);

const readEmailSending = (template) => {
	const locations = parameterLocations(template);
	const parameter = locations[0]?.[EMAIL_SENDING_PARAMETER];
	if (
		locations.length !== 1 ||
		parameter.valueType !== 'BOOLEAN' ||
		Object.keys(parameter.conditionalValues ?? {}).length ||
		!['true', 'false'].includes(parameter.defaultValue?.value)
	) {
		throw new Error(
			'Email sending requires one unconditional BOOLEAN Remote Config value.',
		);
	}
	return parameter.defaultValue.value === 'true';
};

const prepareEmailSending = (template, enabled) => {
	if (typeof enabled !== 'boolean')
		throw new Error('Enabled must be a boolean.');
	const result = structuredClone(template);
	const locations = parameterLocations(result);
	if (locations.length) readEmailSending(result);
	result.parameters ??= {};
	const target = locations[0] ?? result.parameters;
	target[EMAIL_SENDING_PARAMETER] = {
		valueType: 'BOOLEAN',
		defaultValue: { value: String(enabled) },
		description:
			'Allow application email sending. False suppresses registration, reminder, cancellation, password-reset, and test emails. Senders cache for at most 3 minutes; unavailable settings block sends. Keep unconditional.',
	};
	result.version = {
		description: `Set application email sending ${enabled ? 'enabled' : 'disabled'}.`,
	};
	return result;
};

const setEmailSending = async (projectId, enabled) => {
	requireProject(projectId);
	const snapshot = await fetchSnapshot(projectId);
	if (!snapshot.etag || snapshot.etag === '*')
		throw new Error('An exact Remote Config ETag is required.');
	const template = prepareEmailSending(snapshot.template, enabled);
	const response = await fetch(
		`https://firebaseremoteconfig.googleapis.com/v1/projects/${projectId}/remoteConfig`,
		{
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${await getToken()}`,
				'x-goog-user-project': projectId,
				'Content-Type': 'application/json',
				'If-Match': snapshot.etag,
			},
			body: JSON.stringify(template),
			signal: AbortSignal.timeout(30_000),
		},
	);
	if (!response.ok)
		throw new Error(
			`Email setting publication failed: HTTP ${response.status}. Fetch and review current state before retrying.`,
		);
	const published = await response.json();
	if (readEmailSending(published) !== enabled)
		throw new Error('Published email setting does not match the request.');
	return { projectId, enabled, version: published.version?.versionNumber };
};

const main = async () => {
	const [command, flag, project, ...extra] = process.argv.slice(2);
	if (
		flag !== '--project' ||
		extra.length ||
		!['read', 'enable', 'disable'].includes(command)
	) {
		throw new Error(
			'Usage: node scripts/email-sending.cjs <read|enable|disable> --project <projectId>',
		);
	}
	requireProject(project);
	if (command !== 'read')
		return setEmailSending(project, command === 'enable');
	const snapshot = await fetchSnapshot(project);
	return {
		projectId: project,
		enabled: readEmailSending(snapshot.template),
		version: snapshot.template.version?.versionNumber,
	};
};

module.exports = {
	EMAIL_SENDING_PARAMETER,
	readEmailSending,
	prepareEmailSending,
	setEmailSending,
};
if (require.main === module)
	main()
		.then((result) => console.log(JSON.stringify(result, null, 2)))
		.catch((error) => {
			console.error(error.message);
			process.exitCode = 1;
		});
