import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function uiTargets(paths) {
	const targets = new Set();
	for (const path of paths) {
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

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	console.log(
		JSON.stringify({
			target: uiTargets(
				readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean),
			),
		}),
	);
}
