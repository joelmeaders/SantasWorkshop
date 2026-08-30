const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const reviewedAdvisories = new Set([
	'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
	'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
]);
const expectedPath = '.>@angular/build>less>image-size';
const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) {
	process.stderr.write('Run this security gate through pnpm.\n');
	process.exit(1);
}
const pnpmIsScript = /\.[cm]?js$/i.test(pnpmCli);

const audit = spawnSync(
	pnpmIsScript ? process.execPath : pnpmCli,
	pnpmIsScript ? [pnpmCli, 'audit', '--json'] : ['audit', '--json'],
	{
		cwd: path.resolve(__dirname, '..'),
		encoding: 'utf8',
	},
);

if (!audit.stdout) {
	process.stderr.write(
		audit.stderr || audit.error?.message || 'Dependency audit returned no data.\n',
	);
	process.exit(1);
}

let report;
try {
	report = JSON.parse(audit.stdout);
} catch (error) {
	process.stderr.write(`Dependency audit returned invalid JSON: ${error}\n`);
	process.exit(1);
}

const advisories = Object.values(report.advisories ?? {});
const unexpected = advisories.filter((advisory) => {
	if (!reviewedAdvisories.has(advisory.url)) return true;
	if (advisory.module_name !== 'image-size') return true;
	if (advisory.patched_versions !== '<0.0.0') return true;
	return advisory.findings.some((finding) =>
		finding.paths.some((findingPath) => findingPath !== expectedPath),
	);
});

if (unexpected.length > 0) {
	for (const advisory of unexpected) {
		process.stderr.write(
			`${advisory.severity}: ${advisory.module_name} - ${advisory.title}\n`,
		);
	}
	process.exit(1);
}

if (advisories.length > 0) {
	const imageTypesPath = path.resolve(
		__dirname,
		'..',
		'node_modules',
		'.pnpm',
		'image-size@0.5.5',
		'node_modules',
		'image-size',
		'lib',
		'types',
	);
	const imageTypes = fs
		.readdirSync(imageTypesPath)
		.map((file) => path.parse(file).name.toLowerCase());
	const affectedTypes = imageTypes.filter((type) =>
		['heif', 'icns', 'jxl'].includes(type),
	);
	if (affectedTypes.length > 0) {
		process.stderr.write(
			`Reviewed image-size exception is no longer safe: found ${affectedTypes.join(', ')} parser(s).\n`,
		);
		process.exit(1);
	}

	const lessFiles = spawnSync('git', ['ls-files', '--', '*.less'], {
		cwd: path.resolve(__dirname, '..'),
		encoding: 'utf8',
	});
	if (lessFiles.status !== 0 || lessFiles.stdout.trim()) {
		process.stderr.write(
			'Reviewed image-size exception requires a repository with no tracked Less files.\n',
		);
		process.exit(1);
	}
}

process.stdout.write(
	`Dependency audit passed; ${advisories.length} reviewed, unreachable advisory exception(s).\n`,
);
