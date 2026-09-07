const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const {
	PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY,
	parsePublicParameters,
} = require('./public-parameters-schema.cjs');
const { verifyPublicParameters } = require('./verify-public-parameters.cjs');

const PROJECTS = new Set(['santas-workshop-test', 'santas-workshop-193b5']);
const DEFAULTS_PATH = path.resolve(
	__dirname,
	'../santashop-models/src/lib/public-parameters.defaults.ts',
);
const readJson = (filename) =>
	JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
const writeJson = (filename, value) => {
	fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
	fs.writeFileSync(
		path.resolve(filename),
		`${JSON.stringify(value, null, 2)}\n`,
	);
};
const requireProject = (projectId) => {
	if (!PROJECTS.has(projectId))
		throw new Error(
			'Pass an explicit supported test or production project ID.',
		);
	return projectId;
};

const decodeFirestoreValue = (value) => {
	if (Object.hasOwn(value, 'booleanValue')) return value.booleanValue;
	if (Object.hasOwn(value, 'stringValue')) return value.stringValue;
	if (value.mapValue)
		return Object.fromEntries(
			Object.entries(value.mapValue.fields ?? {}).map(([key, child]) => [
				key,
				decodeFirestoreValue(child),
			]),
		);
	throw new Error(
		'Unexpected field type in the legacy public settings document.',
	);
};

const prepareCandidate = (projectId, document, snapshot) => {
	requireProject(projectId);
	if (
		typeof snapshot.etag !== 'string' ||
		!snapshot.etag ||
		snapshot.etag === '*'
	) {
		throw new Error(
			'A specific source Remote Config ETag is required. Fetch a new snapshot.',
		);
	}
	if (
		snapshot.projectId !== projectId ||
		document.name !==
			`projects/${projectId}/databases/(default)/documents/parameters/public`
	)
		throw new Error(
			'The source document and Remote Config snapshot must match the selected project.',
		);
	const decoded = decodeFirestoreValue({
		mapValue: { fields: document.fields },
	});
	// The old client treated an absent alert as disabled. Preserve that behavior.
	decoded.globalAlert ??= {
		displayAlert: false,
		titleEn: '',
		titleEs: '',
		messageEn: '',
		messageEs: '',
	};
	const settings = parsePublicParameters(decoded);
	const existing = structuredClone(snapshot.template);
	const groups = Object.values(existing.parameterGroups ?? {});
	if (
		Object.hasOwn(
			existing.parameters ?? {},
			PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY,
		) ||
		groups.some((group) =>
			Object.hasOwn(
				group.parameters ?? {},
				PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY,
			),
		)
	)
		throw new Error(
			'Remote Config already contains managed public settings; refusing to replace them from legacy Firestore.',
		);
	const candidate = {
		...(existing.conditions ? { conditions: existing.conditions } : {}),
		...(existing.parameterGroups
			? { parameterGroups: existing.parameterGroups }
			: {}),
		parameters: {
			...existing.parameters,
			[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY]: {
				defaultValue: { value: JSON.stringify(settings) },
				valueType: 'JSON',
				description:
					'SantaShop public controls. Publish through the owner App settings screen. Keep unconditional.',
			},
		},
		version: {
			description:
				'Migrate existing Firestore public controls without changing operating settings.',
		},
	};
	verifyPublicParameters(candidate);
	return candidate;
};

const getToken = async () => {
	if (process.env.REMOTE_CONFIG_ACCESS_TOKEN)
		return process.env.REMOTE_CONFIG_ACCESS_TOKEN;
	const functionsRequire = createRequire(
		path.resolve(__dirname, '../santashop-functions/package.json'),
	);
	const { applicationDefault, cert } = functionsRequire('firebase-admin/app');
	const credential = process.env.REMOTE_CONFIG_SERVICE_ACCOUNT
		? cert(JSON.parse(process.env.REMOTE_CONFIG_SERVICE_ACCOUNT))
		: applicationDefault();
	return (await credential.getAccessToken()).access_token;
};

const fetchSnapshot = async (projectId) => {
	requireProject(projectId);
	const response = await fetch(
		`https://firebaseremoteconfig.googleapis.com/v1/projects/${projectId}/remoteConfig`,
		{
			headers: {
				Authorization: `Bearer ${await getToken()}`,
				'x-goog-user-project': projectId,
				'Accept-Encoding': 'gzip',
			},
			signal: AbortSignal.timeout(30_000),
		},
	);
	if (!response.ok)
		throw new Error(
			`Remote Config read failed for ${projectId}: HTTP ${response.status}.`,
		);
	return {
		projectId,
		fetchedAt: new Date().toISOString(),
		etag: response.headers.get('etag'),
		template: await response.json(),
	};
};

const writeDefaults = (projectId, snapshot, output = DEFAULTS_PATH) => {
	requireProject(projectId);
	if (snapshot.projectId !== projectId)
		throw new Error(
			'Defaults snapshot project does not match the requested release project.',
		);
	const { settings, version } = verifyPublicParameters(snapshot);
	if (!version)
		throw new Error(
			'Release defaults require a published template version, not a migration candidate.',
		);
	fs.writeFileSync(
		output,
		[
			"import type { PublicParameters } from './parameters';",
			'',
			`/** Generated from ${projectId} Remote Config version ${version}. Do not edit. */`,
			`export const PUBLIC_PARAMETERS_RELEASE_DEFAULTS: PublicParameters = ${JSON.stringify(settings, null, '\t')};`,
			'',
		].join('\n'),
	);
	return {
		projectId,
		version,
		sha256: crypto
			.createHash('sha256')
			.update(JSON.stringify(settings))
			.digest('hex'),
	};
};

const main = async () => {
	const [command, ...args] = process.argv.slice(2);
	const options = {};
	for (let index = 0; index < args.length; index += 2) {
		if (!args[index].startsWith('--') || !args[index + 1])
			throw new Error('Options require --name value pairs.');
		options[args[index].slice(2)] = args[index + 1];
	}
	const projectId = requireProject(options.project);
	if (command === 'fetch') {
		if (!options.output) throw new Error('fetch requires --output.');
		writeJson(options.output, await fetchSnapshot(projectId));
		console.log(`Saved ${projectId} Remote Config snapshot.`);
	} else if (command === 'prepare') {
		if (!options.document || !options.snapshot || !options.output)
			throw new Error(
				'prepare requires --document, --snapshot, and --output.',
			);
		const document = readJson(options.document);
		const snapshot = readJson(options.snapshot);
		const candidate = prepareCandidate(projectId, document, snapshot);
		writeJson(options.output, candidate);
		writeJson(`${options.output}.provenance.json`, {
			projectId,
			sourceDocumentUpdatedAt: document.updateTime,
			sourceTemplateVersion: snapshot.template.version?.versionNumber,
			expectedEtag: snapshot.etag,
			preparedAt: new Date().toISOString(),
			candidateSha256: crypto
				.createHash('sha256')
				.update(JSON.stringify(candidate))
				.digest('hex'),
		});
		console.log(
			`Prepared ${projectId} candidate. No remote values were changed.`,
		);
	} else if (command === 'defaults' || command === 'release-defaults') {
		const snapshot =
			command === 'release-defaults'
				? await fetchSnapshot(projectId)
				: readJson(options.snapshot);
		console.log(
			JSON.stringify(writeDefaults(projectId, snapshot, options.output)),
		);
	} else {
		throw new Error(
			'Usage: node scripts/remote-config.cjs <fetch|prepare|defaults|release-defaults> --project <projectId> [--snapshot file] [--document file] [--output file]',
		);
	}
};

module.exports = {
	prepareCandidate,
	fetchSnapshot,
	writeDefaults,
	decodeFirestoreValue,
	getToken,
	requireProject,
};
if (require.main === module)
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
