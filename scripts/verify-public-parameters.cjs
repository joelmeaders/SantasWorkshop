const fs = require('node:fs');
const path = require('node:path');
const {
	PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY,
	parsePublicParametersJson,
} = require('./public-parameters-schema.cjs');

const findManagedParameter = (template) => {
	const candidates = [
		template.parameters,
		...Object.values(template.parameterGroups ?? {}).map(
			(group) => group.parameters,
		),
	].filter((parameters) =>
		Object.hasOwn(parameters ?? {}, PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY),
	);
	if (candidates.length !== 1)
		throw new Error(
			`Remote Config must contain exactly one ${PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY} parameter.`,
		);
	return candidates[0][PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY];
};

const verifyPublicParameters = (input) => {
	const template = input?.template ?? input;
	if (!template || typeof template !== 'object' || Array.isArray(template))
		throw new Error('Expected a Remote Config client template.');
	const parameter = findManagedParameter(template);
	if (
		parameter.valueType !== 'JSON' ||
		Object.keys(parameter.conditionalValues ?? {}).length > 0
	)
		throw new Error(
			'Public settings must be an unconditional JSON parameter.',
		);
	if (typeof parameter.defaultValue?.value !== 'string')
		throw new Error('Public settings must have an explicit default value.');
	return {
		settings: parsePublicParametersJson(parameter.defaultValue.value),
		version: String(template.version?.versionNumber ?? ''),
	};
};

module.exports = { findManagedParameter, verifyPublicParameters };

if (require.main === module) {
	try {
		if (!process.argv[2])
			throw new Error(
				'Usage: node scripts/verify-public-parameters.cjs <remote-config-template.json>',
			);
		const result = verifyPublicParameters(
			JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8')),
		);
		console.log(
			`Verified complete Remote Config public settings (version ${result.version || 'candidate'}).`,
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
