import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Limit this exception to maintained prose. Unknown files still select all checks.
export function isDocumentationPath(path) {
	return (
		['README.md', 'CHANGELOG.md'].includes(path) ||
		(path.startsWith('docs/') && path.endsWith('.md'))
	);
}

export function uiTargets(paths) {
	const targets = new Set();
	for (const path of paths) {
		if (isDocumentationPath(path)) continue;
		if (
			path.startsWith('santashop-app/') ||
			path.startsWith('santashop-e2e/tests/public/')
		)
			targets.add('app');
		else if (
			path.startsWith('santashop-admin/') ||
			path.startsWith('santashop-e2e/tests/admin/')
		)
			targets.add('admin');
		else return ['app', 'admin'];
	}
	return targets.size
		? ['app', 'admin'].filter((target) => targets.has(target))
		: ['app', 'admin'];
}

export function functionsRequired(paths) {
	const inputs = paths.filter((path) => !isDocumentationPath(path));
	// Only known UI inputs can omit the backend checks. Backend, shared tooling,
	// rules, E2E fixtures, and unknown inputs keep the full backend validation.
	return (
		inputs.length === 0 ||
		inputs.some(
			(path) =>
				![
					'santashop-app/',
					'santashop-admin/',
					'santashop-core/',
					'.storybook/',
					'storybook-visual/',
					'test-helpers/',
				].some((prefix) => path.startsWith(prefix)),
		)
	);
}

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
