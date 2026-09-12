import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { storybookTargets, storybookTsconfig } from '../.storybook/targets.ts';

const require = createRequire(import.meta.url);
const workspace = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);
const targets = storybookTargets();
const mode = process.argv[2];
let command;
let args;
if (mode === 'typecheck') {
	command = path.join(
		path.dirname(require.resolve('typescript/package.json')),
		'bin/tsc',
	);
	args = ['--noEmit', '-p', storybookTsconfig(targets)];
} else if (mode === 'lint') {
	command = path.join(
		path.dirname(require.resolve('eslint/package.json')),
		'bin/eslint.js',
	);
	args = [
		'.storybook/**/*.ts',
		...targets.map((target) => `santashop-${target}/src/**/*.stories.ts`),
		'vitest.storybook.config.ts',
		'storybook-visual/**/*.ts',
	];
	if (targets.length === 1) {
		args.push(
			'--ignore-pattern',
			targets[0] === 'app'
				? '.storybook/admin/**'
				: '.storybook/registration/**',
		);
	}
} else {
	throw new Error(
		'Use storybook-check.mjs typecheck or storybook-check.mjs lint.',
	);
}
const result = spawnSync(process.execPath, [command, ...args], {
	cwd: workspace,
	stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
