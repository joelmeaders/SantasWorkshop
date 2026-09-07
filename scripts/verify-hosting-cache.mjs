import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const rawArguments = process.argv.slice(2);
const allowUnhashedOutput = rawArguments.includes('--allow-unhashed');
const [firebaseConfigPath = 'firebase.json', ...outputRoots] = rawArguments.filter(
	(argument) => argument !== '--allow-unhashed',
);
const HASHED_BUNDLE_SOURCE = '**/*-????????*.@(css|js)';
const IMMUTABLE_CACHE_CONTROL = 'public,max-age=31536000,immutable';
const STATIC_CACHE_CONTROL = 'public,max-age=3600';
const STATIC_CACHE_SOURCES = new Set([
	'**/assets/**',
	'**/svg/**',
	'**/*.@(avif|eot|gif|ico|jpeg|jpg|otf|png|ttf|webp|woff|woff2)',
]);

const firebaseConfig = JSON.parse(
	await readFile(resolve(firebaseConfigPath), 'utf8'),
);
const angularConfig = JSON.parse(
	await readFile(resolve('angular.json'), 'utf8'),
);
const hostingTargets = Array.isArray(firebaseConfig.hosting)
	? firebaseConfig.hosting
	: [firebaseConfig.hosting];

for (const targetName of ['santashop-app', 'santashop-admin']) {
	const target = hostingTargets.find(
		(candidate) => candidate.target === targetName,
	);
	assert.ok(target, `Missing Firebase Hosting target: ${targetName}`);

	const cacheRules = target.headers.flatMap((definition, index) =>
		definition.headers
			.filter((header) => header.key.toLowerCase() === 'cache-control')
			.map((header) => ({ ...header, source: definition.source, index })),
	);
	const baselineIndex = cacheRules.findIndex(
		(rule) => rule.source === '**' && rule.value === 'no-cache',
	);
	assert.notEqual(
		baselineIndex,
		-1,
		`${targetName}: all request paths need a no-cache baseline`,
	);

	const immutableRule = cacheRules.find(
		(rule) => rule.source === HASHED_BUNDLE_SOURCE,
	);
	assert.ok(
		immutableRule,
		`${targetName}: missing immutable cache rule for hashed bundles`,
	);
	assert.equal(
		immutableRule.value,
		IMMUTABLE_CACHE_CONTROL,
		`${targetName}: hashed bundle cache policy changed`,
	);
	assert.ok(
		immutableRule.index > cacheRules[baselineIndex].index,
		`${targetName}: hashed bundle rule must override the no-cache baseline`,
	);

	for (const source of STATIC_CACHE_SOURCES) {
		const staticRule = cacheRules.find((rule) => rule.source === source);
		assert.ok(
			staticRule,
			`${targetName}: missing bounded cache rule for ${source}`,
		);
		assert.equal(
			staticRule.value,
			STATIC_CACHE_CONTROL,
			`${targetName}: static asset cache policy changed for ${source}`,
		);
		assert.ok(
			staticRule.index > cacheRules[baselineIndex].index &&
			staticRule.index < immutableRule.index,
			`${targetName}: static asset rule must sit between baseline and immutable rules`,
		);
	}

	for (const rule of cacheRules) {
		if (rule.value === IMMUTABLE_CACHE_CONTROL) {
			assert.equal(
				rule.source,
				HASHED_BUNDLE_SOURCE,
				`${targetName}: only content-hashed CSS and JS can be immutable`,
			);
		}
	}
}

for (const projectName of ['santashop-app', 'santashop-admin']) {
	const build = angularConfig.projects[projectName].architect.build;
	const production = build.configurations.production;
	const development = build.configurations.development;
	assert.equal(
		production.outputHashing,
		'all',
		`${projectName}: production builds must hash all output bundles`,
	);
	const expectedServiceWorker = `${projectName}/ngsw-config.json`;
	assert.equal(
		production.serviceWorker,
		expectedServiceWorker,
		`${projectName}: production builds must generate the service worker manifest`,
	);
	assert.equal(
		development.serviceWorker,
		expectedServiceWorker,
		`${projectName}: deployable development builds must generate the service worker manifest`,
	);

	const serviceWorkerConfig = JSON.parse(
		await readFile(resolve(expectedServiceWorker), 'utf8'),
	);
	assert.equal(
		serviceWorkerConfig.index,
		'/index.html',
		`${projectName}: service worker must use the deployed SPA index`,
	);
	const shellFiles = serviceWorkerConfig.assetGroups
		?.find((assetGroup) => assetGroup.name === 'app-shell')?.resources?.files;
	assert.ok(shellFiles, `${projectName}: app-shell asset group is required`);
	for (const shellFile of ['/index.html', '/main*.js', '/styles*.css']) {
		assert.ok(
			shellFiles.includes(shellFile),
			`${projectName}: app-shell must include ${shellFile}`,
		);
	}
	assert.equal(
		serviceWorkerConfig.dataGroups,
		undefined,
		`${projectName}: service worker must not cache API responses`,
	);
	for (const assetGroup of serviceWorkerConfig.assetGroups ?? []) {
		assert.equal(
			assetGroup.resources.urls,
			undefined,
			`${projectName}: service worker must cache same-origin files only`,
		);
		for (const file of assetGroup.resources.files ?? []) {
			assert.match(
				file,
				/^\//,
				`${projectName}: service worker file pattern must be same-origin: ${file}`,
			);
		}
	}
}

for (const outputRoot of outputRoots) {
	const root = resolve(outputRoot);
	const indexPath = resolve(root, 'index.html');
	const html = await readFile(indexPath, 'utf8');
	const manifestPath = resolve(root, 'ngsw.json');
	const workerPath = resolve(root, 'ngsw-worker.js');
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	assert.equal(
		manifest.index,
		'/index.html',
		`${manifestPath}: generated service worker must use the deployed SPA index`,
	);
	assert.ok(
		!manifest.dataGroups?.length,
		`${manifestPath}: generated service worker must not cache API responses`,
	);
	const shell = manifest.assetGroups?.find(
		(assetGroup) => assetGroup.name === 'app-shell',
	);
	assert.ok(shell, `${manifestPath}: generated app-shell group is required`);
	assert.ok(
		shell.urls?.includes('/index.html'),
		`${manifestPath}: generated app shell must include index.html`,
	);
	assert.ok(
		shell.urls?.some((url) => /^\/main(?:-[^/]+)?\.js$/.test(url)),
		`${manifestPath}: generated app shell must include the main bundle`,
	);
	assert.ok(
		shell.urls?.some((url) => /^\/styles(?:-[^/]+)?\.css$/.test(url)),
		`${manifestPath}: generated app shell must include the styles bundle`,
	);
	for (const assetGroup of manifest.assetGroups ?? []) {
		for (const url of [...(assetGroup.urls ?? []), ...(assetGroup.patterns ?? [])]) {
			assert.match(
				url,
				/^\//,
				`${manifestPath}: generated service worker resource must be same-origin: ${url}`,
			);
		}
	}
	const assets = [
		...html.matchAll(/(?:src|href)=["']([^"']+\.(?:css|js))["']/gi),
	]
		.map(([, asset]) => asset)
		.filter((asset) => !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(asset));

	assert.ok(assets.length, `${indexPath}: no local CSS or JS bundles found`);
	await stat(manifestPath);
	await stat(workerPath);
	for (const asset of assets) {
		const assetPath = resolve(root, asset.split(/[?#]/, 1)[0]);
		await stat(assetPath);
		if (!allowUnhashedOutput) {
			assert.match(
				basename(assetPath),
				/^[^/]+-[A-Za-z0-9_-]{8,}\.(?:css|js)$/,
				`${indexPath}: production bundle is not content-hashed: ${asset}`,
			);
		}
	}
}

console.log(
	`Hosting cache policy is valid for ${outputRoots.length} checked build output(s).`,
);
