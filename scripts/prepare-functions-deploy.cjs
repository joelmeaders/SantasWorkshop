const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
const functionsDir = path.join(projectDir, 'santashop-functions');
const distDir = path.join(functionsDir, 'dist');
const deployDir = path.join(projectDir, '.firebase-functions-deploy');

const run = (command, args, options = {}) =>
	execFileSync(command, args, {
		cwd: projectDir,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'inherit'],
		...options,
	});

const resolveRuntimeDependencies = () => {
	const output = run('pnpm', [
		'--filter',
		'@santashop/functions',
		'list',
		'--prod',
		'--depth',
		'0',
		'--json',
	]);
	const projects = JSON.parse(output);
	const dependencies = projects[0]?.dependencies;

	if (!dependencies || Object.keys(dependencies).length === 0) {
		throw new Error('Unable to resolve Functions runtime dependencies.');
	}

	return Object.fromEntries(
		Object.entries(dependencies)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([name, metadata]) => {
				if (!metadata.version) {
					throw new Error(`Missing resolved version for ${name}.`);
				}
				return [name, metadata.version];
			}),
	);
};

const assertSafeDeployDirectory = () => {
	const relative = path.relative(projectDir, deployDir);
	if (
		relative !== '.firebase-functions-deploy' ||
		relative.startsWith('..') ||
		path.isAbsolute(relative)
	) {
		throw new Error(`Unsafe Functions deploy directory: ${deployDir}`);
	}
};

const copyRuntimeEnvironmentFile = () => {
	const projectEnvironmentFiles = {
		test: '.env.santas-workshop-test',
		prod: '.env.santas-workshop-193b5',
	};
	const environmentFile =
		projectEnvironmentFiles[process.env.SANTASHOP_FUNCTIONS_DEPLOY];
	if (!environmentFile) {
		throw new Error(
			'SANTASHOP_FUNCTIONS_DEPLOY must select test or prod before preparing an artifact.',
		);
	}

	const sourcePath = path.join(functionsDir, environmentFile);
	if (!fs.existsSync(sourcePath)) {
		throw new Error(
			`Required Functions environment file is missing: ${environmentFile}`,
		);
	}

	fs.copyFileSync(sourcePath, path.join(deployDir, environmentFile));
};

const prepareDeployArtifact = () => {
	assertSafeDeployDirectory();
	if (!fs.existsSync(path.join(distDir, 'index.js'))) {
		throw new Error(
			'Functions build output is missing. Run the Functions build first.',
		);
	}

	const sourcePackage = JSON.parse(
		fs.readFileSync(path.join(functionsDir, 'package.json'), 'utf8'),
	);
	const dependencies = resolveRuntimeDependencies();

	fs.rmSync(deployDir, { recursive: true, force: true });
	fs.mkdirSync(deployDir, { recursive: true });
	fs.cpSync(distDir, path.join(deployDir, 'dist'), { recursive: true });
	copyRuntimeEnvironmentFile();

	const deployPackage = {
		name: sourcePackage.name,
		version: '0.0.0',
		private: true,
		main: sourcePackage.main,
		engines: { node: '24' },
		dependencies,
		overrides: {
			'uuid@<11.1.1': '11.1.1',
		},
	};

	fs.writeFileSync(
		path.join(deployDir, 'package.json'),
		`${JSON.stringify(deployPackage, null, 2)}\n`,
	);

	run(
		'npm',
		[
			'install',
			'--package-lock-only',
			'--ignore-scripts',
			'--no-audit',
			'--no-fund',
		],
		{ cwd: deployDir, stdio: 'inherit' },
	);
	run(
		'npm',
		['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
		{ cwd: deployDir, stdio: 'inherit' },
	);

	const firebaseFunctionsSdk = path.join(
		deployDir,
		'node_modules',
		'firebase-functions',
		'package.json',
	);
	if (!fs.existsSync(firebaseFunctionsSdk)) {
		throw new Error(
			'Functions deploy artifact is missing the Firebase Functions SDK required for source analysis.',
		);
	}

	const artifactText = fs.readFileSync(
		path.join(deployDir, 'package.json'),
		'utf8',
	);
	if (
		artifactText.includes('catalog:') ||
		artifactText.includes('workspace:')
	) {
		throw new Error(
			'Functions deploy artifact contains workspace-only dependency notation.',
		);
	}

	console.log(
		`Prepared self-analyzable npm-compatible Functions artifact with ${Object.keys(dependencies).length} runtime dependencies.`,
	);
};

if (require.main === module) {
	prepareDeployArtifact();
}

module.exports = {
	prepareDeployArtifact,
	resolveRuntimeDependencies,
};
