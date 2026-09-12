import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const targets = ['app', 'admin'];
export const isDocumentationPath = (path) =>
	/(?:^|\/)(?:AGENTS|README|CHANGELOG)\.md$/.test(path) ||
	(path.startsWith('docs/') && path.endsWith('.md'));

// Validation and publication are independent. Test inputs never publish code.
export function selectChanges(paths) {
	const selected = {
		ui: new Set(),
		e2e: new Set(),
		storybook: new Set(),
		shared: false,
		functions: false,
		tooling: false,
		deploy: new Set(),
	};
	const ui = (names = targets, publish = false) => {
		for (const name of names) {
			selected.ui.add(name);
			selected.e2e.add(name);
			selected.storybook.add(name);
			if (publish) selected.deploy.add(name);
		}
	};
	const backend = (publish = false) => {
		selected.functions = true;
		targets.forEach((name) => selected.e2e.add(name));
		if (publish) selected.deploy.add('functions');
	};
	for (const path of paths) {
		if (isDocumentationPath(path)) continue;
		const app = path.match(/^santashop-(app|admin)\//)?.[1];
		if (app) {
			if (/\.stories\.[^/]+$/.test(path)) selected.storybook.add(app);
			else if (
				/\.spec\.[^/]+$/.test(path) ||
				/(?:vitest|tsconfig\.spec)/.test(path)
			)
				selected.ui.add(app);
			else ui([app], true);
			continue;
		}
		if (
			path.startsWith('santashop-core/') ||
			path.startsWith('santashop-models/')
		) {
			selected.shared = true;
			const runtime = !/\.spec\.|tsconfig\.spec|vitest/.test(path);
			ui(targets, runtime);
			if (path.startsWith('santashop-models/')) backend(runtime);
			continue;
		}
		if (path.startsWith('santashop-functions/')) {
			if (/\/test\/|\.spec\.|vitest|eslint|\/scripts\//.test(path))
				selected.functions = true;
			else backend(true);
			continue;
		}
		if (path.startsWith('santashop-e2e/')) {
			const name = path.startsWith('santashop-e2e/tests/public/')
				? 'app'
				: path.startsWith('santashop-e2e/tests/admin/')
					? 'admin'
					: undefined;
			(name ? [name] : targets).forEach((target) =>
				selected.e2e.add(target),
			);
			continue;
		}
		if (
			path.startsWith('.storybook/') ||
			path.startsWith('storybook-visual/') ||
			/^(tsconfig\.storybook|vitest\.storybook)/.test(path) ||
			path.startsWith('scripts/storybook-')
		) {
			const name = /\/registration-/.test(path)
				? 'app'
				: /\/admin-/.test(path)
					? 'admin'
					: undefined;
			(name ? [name] : targets).forEach((target) =>
				selected.storybook.add(target),
			);
			if (path.startsWith('scripts/storybook-')) selected.tooling = true;
			continue;
		}
		if (
			path.startsWith('test-helpers/') ||
			/^(eslint\.config|vitest\.)/.test(path)
		) {
			ui(path === 'vitest.admin.config.mjs' ? ['admin'] : targets);
			selected.shared = path !== 'vitest.admin.config.mjs';
			if (path === 'eslint.config.js') selected.functions = true;
			continue;
		}
		if (
			[
				'firestore.rules',
				'firestore.indexes.json',
				'storage.rules',
				'database.rules.json',
			].includes(path)
		) {
			backend();
			selected.deploy.add('rules');
			continue;
		}
		if (path === 'firebase.e2e.json') {
			targets.forEach((target) => selected.e2e.add(target));
			continue;
		}

		if (path.startsWith('.github/workflows/')) {
			selected.tooling = true;
			if (path.endsWith('/storybook-pr-validation.yml'))
				targets.forEach((target) => selected.storybook.add(target));
			else if (path.endsWith('/e2e-target.yml'))
				targets.forEach((target) => selected.e2e.add(target));
			else if (
				path.endsWith('/functions-pr-validation.yml') ||
				path.endsWith('/functions-test-and-prod-release.yml')
			)
				backend();
			else if (path.endsWith('/app-test-and-prod-release.yml'))
				ui(['app']);
			else if (path.endsWith('/admin-test-and-prod-release.yml'))
				ui(['admin']);
			else if (path.endsWith('/ui-target.yml')) ui();
			else if (path.endsWith('/app-pr-validation.yml')) {
				ui();
				backend();
				selected.shared = true;
			}
			continue;
		}
		if (/^scripts\/(?:ci-|ui-targets|release-|github-secrets)/.test(path)) {
			selected.tooling = true;
			continue;
		}

		if (path.startsWith('scripts/verify-admin-')) {
			ui(['admin']);
			continue;
		}
		if (/^scripts\/verify-(hosting|service-worker)/.test(path)) {
			ui();
			continue;
		}
		if (
			/^scripts\/(?:verify-functions|owner-export-readiness|verify-public-parameters|email-sending)/.test(
				path,
			)
		) {
			selected.functions = true;
			continue;
		}
		if (
			path.startsWith('scripts/load/') &&
			!path.startsWith('scripts/load/functions/') &&
			path !== 'scripts/load/configuration.cjs'
		) {
			selected.tooling = true;
			continue;
		}
		if (/^scripts\/remote-config-(deploy|gateway|readiness)/.test(path)) {
			backend(true);
			continue;
		}
		if (
			path.startsWith('remote-config/') ||
			/^scripts\/(?:remote-config|public-parameters)/.test(path)
		) {
			ui(targets, true);
			backend(true);
			continue;
		}
		if (path === 'config.firebase.cjs') {
			ui(targets, true);
			continue;
		}
		if (
			path === 'config.functions.cjs' ||
			/^scripts\/(?:assert-functions-deploy|prepare-functions-deploy|load\/functions\/|load\/configuration)/.test(
				path,
			)
		) {
			backend(true);
			continue;
		}
		// Unknown shared inputs select all consumers until their ownership is declared.
		ui(targets, true);
		backend(true);
		selected.shared = true;
	}
	return {
		...selected,
		ui: targets.filter((name) => selected.ui.has(name)),
		e2e: targets.filter((name) => selected.e2e.has(name)),
		storybook: targets.filter((name) => selected.storybook.has(name)),
		deploy: ['app', 'admin', 'functions', 'rules'].filter((name) =>
			selected.deploy.has(name),
		),
	};
}
export const uiTargets = (paths) => selectChanges(paths).ui;
export const functionsRequired = (paths) => selectChanges(paths).functions;
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const paths = readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean);
	console.log(
		JSON.stringify(
			process.argv[2] === '--functions'
				? functionsRequired(paths)
				: { target: uiTargets(paths) },
		),
	);
}
