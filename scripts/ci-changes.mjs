import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configImpact } from './ci-config-impact.mjs';
import { selectChanges } from './ui-targets.mjs';

export function changesBetween(
	base,
	head,
	event,
	git = (args) => execFileSync('git', args, { encoding: 'utf8' }),
) {
	if (
		![base, head].every(
			(sha) => /^[0-9a-f]{40}$/.test(sha) && !/^0+$/.test(sha),
		)
	)
		throw new Error('Change detection requires two full commit SHAs.');
	const start =
		event === 'pull_request'
			? git(['merge-base', base, head]).trim()
			: base;
	const paths = git([
		'diff',
		'--name-only',
		'--no-renames',
		'-z',
		start,
		head,
	])
		.split('\0')
		.filter(Boolean);
	const read = (revision) => {
		const cache = new Map();
		return (path) => {
			if (!cache.has(path))
				cache.set(
					path,
					git(['ls-tree', revision, '--', path]).trim()
						? git(['show', revision + ':' + path])
						: '',
				);
			return cache.get(path);
		};
	};
	const before = read(start);
	const after = read(head);
	const structured = new Set([
		'package.json',
		'angular.json',
		'firebase.json',
		'pnpm-lock.yaml',
		'pnpm-workspace.yaml',
	]);
	const inputs = paths.flatMap((path) =>
		structured.has(path) ||
		/^santashop-(app|admin|core|models|functions|e2e)\/package\.json$/.test(
			path,
		)
			? (configImpact(path, before(path), after(path), before, after) ?? [
					path,
				])
			: [path],
	);
	return { paths, ...selectChanges(inputs) };
}
export function changeOutputs(selection) {
	const outputs = {};
	for (const key of ['ui', 'e2e', 'storybook']) {
		outputs[key] = String(selection[key].length > 0);
		outputs[`${key}_matrix`] = JSON.stringify({ target: selection[key] });
	}
	for (const key of ['shared', 'functions', 'tooling'])
		outputs[key] = String(selection[key]);
	for (const key of ['app', 'admin', 'functions', 'rules'])
		outputs[`deploy_${key}`] = String(selection.deploy.includes(key));
	return outputs;
}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const selection = changesBetween(
		process.env.BASE_SHA,
		process.env.HEAD_SHA,
		process.env.CHANGE_EVENT,
	);
	const outputs = changeOutputs(selection);
	console.log(JSON.stringify(selection, null, 2));
	if (process.env.GITHUB_OUTPUT)
		appendFileSync(
			process.env.GITHUB_OUTPUT,
			Object.entries(outputs)
				.map(([key, value]) => `${key}=${value}\n`)
				.join(''),
		);
	if (process.env.GITHUB_STEP_SUMMARY)
		appendFileSync(
			process.env.GITHUB_STEP_SUMMARY,
			`### Selected work\n\n\`\`\`json\n${JSON.stringify(selection, null, 2)}\n\`\`\`\n`,
		);
}
