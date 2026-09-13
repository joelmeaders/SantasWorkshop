import { createRequire } from 'node:module';
import { posix } from 'node:path';

// Reuse the YAML parser already installed with ESLint.
const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint'))('js-yaml');
const SHARED = 'scripts/__shared-input__';
const UI = 'santashop-core/__build-input__';
const E2E = 'firebase.e2e.json';
const STORYBOOK = '.storybook/__tooling__';
const projects = [
	'santashop-app',
	'santashop-admin',
	'santashop-core',
	'santashop-models',
	'santashop-functions',
	'santashop-e2e',
];
const dependencyFields = [
	'dependencies',
	'devDependencies',
	'optionalDependencies',
	'peerDependencies',
];

function canonical(value) {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonical(value[key])]),
		);
	}
	return value;
}

function equal(a, b) {
	return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function changedKeys(a = {}, b = {}) {
	return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
		(key) => !equal(a[key], b[key]),
	);
}

function omit(object, keys) {
	return Object.fromEntries(
		Object.entries(object).filter(([key]) => !keys.includes(key)),
	);
}

function projectInput(project) {
	return project === 'santashop-e2e'
		? E2E
		: projects.includes(project)
			? `${project}/__build-input__`
			: SHARED;
}

function packageDependencyInput(project, dependency, field) {
	if (
		field === 'devDependencies' &&
		/eslint|vitest|^globals$|^prettier$|^playwright$|^@playwright\/test$|^@testing-library\//.test(
			dependency,
		)
	) {
		return project === 'santashop-e2e'
			? E2E
			: `${project}/__config__.spec.ts`;
	}
	return projectInput(project);
}

function validationScript(name) {
	return /^(?:pre|post)?(?:test|lint)(?::|$)/.test(name);
}

function leafPackageImpact(project, before, after) {
	const result = [];
	for (const key of changedKeys(before, after)) {
		if (
			[
				'description',
				'author',
				'license',
				'keywords',
				'homepage',
				'repository',
				'bugs',
				'contributors',
			].includes(key)
		)
			continue;
		if (key === 'scripts') {
			for (const name of changedKeys(before.scripts, after.scripts)) {
				result.push(
					project === 'santashop-e2e'
						? E2E
						: validationScript(name)
							? `${project}/__config__.spec.ts`
							: projectInput(project),
				);
			}
		} else if (dependencyFields.includes(key)) {
			for (const dependency of changedKeys(before[key], after[key]))
				result.push(packageDependencyInput(project, dependency, key));
		} else result.push(projectInput(project));
	}
	return result;
}

function parse(text, yaml = false) {
	if (typeof text !== 'string' || !text.trim())
		throw new Error('Missing config content');
	const value = yaml ? load(text) : JSON.parse(text);
	if (!value || Array.isArray(value) || typeof value !== 'object')
		throw new Error('Expected a config object');
	return value;
}

function scriptImpact(name) {
	if (name === 'storybook:prepare')
		return [STORYBOOK, 'test-helpers/__tooling__'];
	if (['ci:ui:shared', 'ci:ui:test'].includes(name))
		return ['test-helpers/__tooling__'];
	const parts = name.split(/[:-]/);
	if (parts.includes('storybook')) return [STORYBOOK];
	if (parts.includes('e2e')) {
		if (parts.includes('admin'))
			return ['santashop-e2e/tests/admin/__tooling__'];
		if (parts.includes('app') || parts.includes('public'))
			return ['santashop-e2e/tests/public/__tooling__'];
		return [E2E];
	}
	for (const project of ['app', 'admin', 'core', 'models', 'functions']) {
		if (parts.includes(project)) {
			return [
				`santashop-${project}/${(parts.includes('test') || parts.includes('lint')) && !parts.includes('build') && !parts.includes('deploy') && !parts.includes('config') ? '__config__.spec.ts' : '__build-input__'}`,
			];
		}
	}
	if (name.startsWith('emulators:')) return [E2E];
	if (name === 'test:browser:setup') return ['test-helpers/__tooling__'];
	return [SHARED];
}

function rootScriptImpact(name, before, after) {
	const result = scriptImpact(name);
	// Tests remain validation inputs, even when a build command runs them.
	if (result.every((path) => path.endsWith('__config__.spec.ts')))
		return result;
	const scriptMaps = [before.scripts ?? {}, after.scripts ?? {}];
	const visited = new Set([name]);
	const pending = [name];
	while (pending.length) {
		const dependency = pending.pop();
		for (const scripts of scriptMaps) {
			for (const [caller, command] of Object.entries(scripts)) {
				if (visited.has(caller)) continue;
				const calls = [
					...command.matchAll(
						/(?:^|[\s;&|("'])\b(?:pnpm|npm)\s+(?:run\s+)?([\w:.-]+)/g,
					),
				].map((match) => match[1]);
				if (!calls.includes(dependency)) continue;
				visited.add(caller);
				pending.push(caller);
				// An aggregate test script does not make unrelated sibling suites
				// relevant. Add runtime callers, which can consume a shared helper.
				result.push(
					...scriptImpact(caller).filter(
						(path) =>
							path === SHARED || path.endsWith('__build-input__'),
					),
				);
			}
		}
	}
	return result;
}

function rootDependencyImpact(name, readers) {
	if (/storybook|^@types\/react$|^react(?:-dom)?$/.test(name))
		return [STORYBOOK];
	if (
		/^(?:@axe-core\/playwright|@playwright\/test|wait-on|concurrently)$/.test(
			name,
		)
	)
		return [E2E];
	if (/eslint|^globals$|^prettier$/.test(name)) return ['eslint.config.js'];
	if (/vitest|^playwright$/.test(name)) return ['test-helpers/__tooling__'];
	// These tools build the Angular applications from the root importer.
	if (
		/^@angular\/(?:build|cli|compiler|compiler-cli)$|^@ionic\/angular-toolkit$|^@analogjs\/|^(?:typescript|ts-node|ng-packagr|sass|esbuild|vite)$/.test(
			name,
		)
	)
		return [UI];
	const consumers = new Set();
	for (const read of readers.filter(Boolean)) {
		for (const project of projects.filter(
			(candidate) => candidate !== 'santashop-functions',
		)) {
			const text = read(`${project}/package.json`);
			if (!text) continue;
			const manifest = parse(text);
			if (
				dependencyFields.some(
					(field) => manifest[field]?.[name] !== undefined,
				)
			)
				consumers.add(projectInput(project));
		}
	}
	return consumers.size
		? [...consumers]
		: /^@angular\//.test(name)
			? [UI]
			: [SHARED];
}

function packageImpact(before, after, readers) {
	const result = [];
	for (const key of changedKeys(before, after)) {
		if (
			[
				'version',
				'description',
				'author',
				'license',
				'keywords',
				'homepage',
				'repository',
				'bugs',
			].includes(key)
		)
			continue;
		if (key === 'scripts') {
			for (const name of changedKeys(before.scripts, after.scripts))
				result.push(...rootScriptImpact(name, before, after));
		} else if (dependencyFields.includes(key)) {
			for (const name of changedKeys(before[key], after[key]))
				result.push(...rootDependencyImpact(name, readers));
		} else if (
			key === 'pnpm' &&
			equal(
				omit(before.pnpm ?? {}, ['overrides']),
				omit(after.pnpm ?? {}, ['overrides']),
			)
		) {
			const [oldLock, newLock] = readers.map((read) =>
				read?.('pnpm-lock.yaml'),
			);
			result.push(
				...(oldLock && newLock
					? lockImpact(
							parse(oldLock, true),
							parse(newLock, true),
							readers,
						)
					: [SHARED]),
			);
		} else result.push(SHARED);
	}
	return result;
}

function angularImpact(before, after) {
	const result = [];
	for (const key of changedKeys(before, after)) {
		if (key !== 'projects') {
			result.push(UI);
			continue;
		}
		for (const name of changedKeys(before.projects, after.projects)) {
			const a = before.projects?.[name] ?? {};
			const b = after.projects?.[name] ?? {};
			if (
				!equal(
					omit(a, ['architect', 'targets']),
					omit(b, ['architect', 'targets']),
				)
			)
				result.push(projectInput(name));
			for (const section of ['architect', 'targets']) {
				for (const target of changedKeys(a[section], b[section])) {
					result.push(
						/storybook/.test(target)
							? STORYBOOK
							: /^(test|lint)$/.test(target)
								? `${name}/__config__.spec.ts`
								: projectInput(name),
					);
				}
			}
		}
	}
	return result;
}

function hostingMap(hosting) {
	const entries = hosting
		? Array.isArray(hosting)
			? hosting
			: [hosting]
		: [];
	const result = {};
	for (const entry of entries) {
		const name = entry.target ?? entry.site;
		if (!name || result[name])
			throw new Error('Hosting target is missing or duplicated');
		result[name] = entry;
	}
	return result;
}

function firebaseImpact(before, after) {
	const result = [];
	for (const key of changedKeys(before, after)) {
		if (key === 'hosting') {
			for (const target of changedKeys(
				hostingMap(before.hosting),
				hostingMap(after.hosting),
			))
				result.push(projectInput(target));
		} else if (key === 'functions')
			result.push(projectInput('santashop-functions'));
		else if (key === 'emulators') result.push(E2E);
		else if (['firestore', 'storage', 'database'].includes(key)) {
			const entries = [before[key], after[key]].flat().filter(Boolean);
			const files = entries
				.flatMap((entry) => [entry.rules, entry.indexes])
				.filter(Boolean);
			result.push(...(files.length ? files : [SHARED]));
		} else result.push(SHARED);
	}
	return result;
}

function catalogImpact(name, dependency, readers) {
	const consumers = new Set();
	let foundManifest = false;
	for (const read of readers.filter(Boolean)) {
		for (const project of ['.', ...projects]) {
			const text = read(
				project === '.' ? 'package.json' : `${project}/package.json`,
			);
			if (!text) continue;
			foundManifest = true;
			const manifest = parse(text);
			const expected =
				name === 'default'
					? ['catalog:', 'catalog:default']
					: [`catalog:${name}`];
			for (const field of dependencyFields.filter((candidate) =>
				expected.includes(manifest[candidate]?.[dependency]),
			)) {
				for (const input of project === '.'
					? rootDependencyImpact(dependency, readers)
					: [packageDependencyInput(project, dependency, field)])
					consumers.add(input);
			}
		}
	}
	if (consumers.size || foundManifest) return [...consumers];
	return name === 'functions'
		? [projectInput('santashop-functions')]
		: [SHARED];
}

function workspaceImpact(before, after, readers) {
	const result = [];
	if (
		!equal(
			omit(before, ['catalog', 'catalogs']),
			omit(after, ['catalog', 'catalogs']),
		)
	)
		result.push(SHARED);
	const catalogs = (value) => ({
		...value.catalogs,
		default: value.catalog ?? value.catalogs?.default ?? {},
	});
	const a = catalogs(before);
	const b = catalogs(after);
	for (const name of changedKeys(a, b)) {
		for (const dependency of changedKeys(a[name], b[name]))
			result.push(...catalogImpact(name, dependency, readers));
	}
	return result;
}

// Include the resolved graph, peer variants, and package integrity. A transitive
// update can change an artifact even when its importer version did not change.
function dependencyClosure(lock, importer, dependency, entry) {
	if (entry === undefined) return undefined;
	const seen = new Map();
	function visit(name, reference, from) {
		const version =
			typeof reference === 'object' ? reference.version : reference;
		if (typeof version !== 'string')
			throw new Error('Missing locked dependency version');
		if (version.startsWith('link:')) {
			const linked = posix.normalize(posix.join(from, version.slice(5)));
			const key = `importer:${linked}`;
			if (seen.has(key)) return;
			const target = lock.importers?.[linked];
			if (!target) throw new Error(`Missing linked importer ${linked}`);
			seen.set(key, target);
			for (const field of dependencyFields)
				for (const [child, ref] of Object.entries(target[field] ?? {}))
					visit(child, ref, linked);
			return;
		}
		const candidates = [`${name}@${version}`, version.replace(/^npm:/, '')];
		const key = candidates.find(
			(candidate) => lock.snapshots?.[candidate] !== undefined,
		);
		if (!key) throw new Error(`Missing locked snapshot ${name}@${version}`);
		if (seen.has(key)) return;
		const snapshot = lock.snapshots[key];
		const packageKey = key.split('(')[0];
		const metadata = lock.packages?.[packageKey];
		if (!metadata) throw new Error(`Missing locked package ${packageKey}`);
		seen.set(key, { snapshot, metadata });
		for (const field of ['dependencies', 'optionalDependencies']) {
			for (const [child, ref] of Object.entries(snapshot[field] ?? {}))
				visit(child, ref, from);
		}
	}
	visit(dependency, entry, importer);
	return {
		entry,
		graph: Object.fromEntries(
			[...seen].sort(([a], [b]) => a.localeCompare(b)),
		),
	};
}

function lockImpact(before, after, readers) {
	if (
		String(before.lockfileVersion) !== '9.0' ||
		String(after.lockfileVersion) !== '9.0'
	)
		return [SHARED];
	// Overrides are accounted for through the resulting resolved dependency graph.
	const ignored = [
		'importers',
		'packages',
		'snapshots',
		'catalogs',
		'overrides',
	];
	const result = equal(omit(before, ignored), omit(after, ignored))
		? []
		: [SHARED];
	for (const name of new Set([
		...Object.keys(before.importers ?? {}),
		...Object.keys(after.importers ?? {}),
	])) {
		const a = before.importers?.[name] ?? {};
		const b = after.importers?.[name] ?? {};
		if (!equal(omit(a, dependencyFields), omit(b, dependencyFields)))
			result.push(name === '.' ? SHARED : projectInput(name));
		for (const field of dependencyFields) {
			for (const dependency of new Set([
				...Object.keys(a[field] ?? {}),
				...Object.keys(b[field] ?? {}),
			])) {
				if (
					!equal(
						dependencyClosure(
							before,
							name,
							dependency,
							a[field]?.[dependency],
						),
						dependencyClosure(
							after,
							name,
							dependency,
							b[field]?.[dependency],
						),
					)
				) {
					result.push(
						...(name === '.'
							? rootDependencyImpact(dependency, readers)
							: [
									packageDependencyInput(
										name,
										dependency,
										field,
									),
								]),
					);
				}
			}
		}
	}
	for (const name of changedKeys(before.catalogs, after.catalogs)) {
		for (const dependency of changedKeys(
			before.catalogs?.[name],
			after.catalogs?.[name],
		))
			result.push(...catalogImpact(name, dependency, readers));
	}
	return result;
}

/** Convert a config diff into ordinary paths that the CI selector understands. */
export function configImpact(
	path,
	beforeText,
	afterText,
	readBefore,
	readAfter,
) {
	const handlers = {
		'package.json': packageImpact,
		'angular.json': angularImpact,
		'firebase.json': firebaseImpact,
		'pnpm-workspace.yaml': workspaceImpact,
		'pnpm-lock.yaml': lockImpact,
	};
	const project = path.match(
		/^(santashop-(?:app|admin|functions|core|models|e2e))\/package\.json$/,
	)?.[1];
	const handler = project
		? (before, after) => leafPackageImpact(project, before, after)
		: handlers[path];
	if (!handler) return null;
	try {
		const yaml = path.endsWith('.yaml');
		const result = handler(
			parse(beforeText, yaml),
			parse(afterText, yaml),
			[readBefore, readAfter],
		);
		return [...new Set(result)].sort();
	} catch {
		// Missing history, unsupported lock references, and malformed config must
		// select checks instead of silently skipping a potentially affected unit.
		return [SHARED];
	}
}
