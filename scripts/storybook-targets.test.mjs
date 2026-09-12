import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
	selectStorybookEntries,
	storybookTargets,
	storybookTsconfig,
} from '../.storybook/targets.ts';

test('Storybook defaults to both apps and accepts each supported selection', () => {
	assert.deepEqual(storybookTargets('app,admin'), ['app', 'admin']);
	assert.deepEqual(storybookTargets(' app '), ['app']);
	assert.deepEqual(storybookTargets('admin'), ['admin']);
	assert.deepEqual(storybookTargets('admin,app,admin'), ['admin', 'app']);
	const previous = process.env.STORYBOOK_TARGETS;
	delete process.env.STORYBOOK_TARGETS;
	try {
		assert.deepEqual(storybookTargets(), ['app', 'admin']);
	} finally {
		if (previous !== undefined) process.env.STORYBOOK_TARGETS = previous;
	}
});

test('An invalid or explicitly empty selection cannot silently skip coverage', () => {
	for (const value of ['', ' ', 'app,', ',admin', 'app,functions', 'APP']) {
		assert.throws(() => storybookTargets(value), /STORYBOOK_TARGETS/);
	}
});

const entries = [
	{
		id: 'customer--default',
		type: 'story',
		importPath: './santashop-app/src/home.stories.ts',
	},
	{
		id: 'admin--default',
		type: 'story',
		importPath: '.\\santashop-admin\\src\\home.stories.ts',
	},
	{
		id: 'introduction',
		type: 'docs',
		importPath: './.storybook/Introduction.mdx',
	},
];

test('Visual selection uses the source app and preserves story IDs for existing baselines', () => {
	assert.deepEqual(selectStorybookEntries(entries, ['app']), [entries[0]]);
	assert.deepEqual(selectStorybookEntries(entries, ['admin']), [entries[1]]);
	assert.deepEqual(
		selectStorybookEntries(entries, ['app', 'admin']),
		entries.slice(0, 2),
	);
});

test('A missing target or unknown story source fails instead of passing incomplete coverage', () => {
	assert.throws(
		() => selectStorybookEntries([entries[0]], ['admin']),
		/no stories for admin/,
	);
	assert.throws(
		() => selectStorybookEntries([entries[0]], ['app', 'admin']),
		/no stories for admin/,
	);
	assert.throws(
		() => selectStorybookEntries([{ type: 'story' }], ['app']),
		/no known app source/,
	);
});

test('Each selected typecheck config includes only its app stories and the shared harness', () => {
	assert.equal(
		storybookTsconfig(['app', 'admin']),
		'tsconfig.storybook.json',
	);
	for (const target of ['app', 'admin']) {
		const file = storybookTsconfig([target]);
		const config = JSON.parse(
			readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'),
		);
		assert.equal(config.extends, './tsconfig.storybook.json');
		assert.deepEqual(
			config.include.filter((value) => value.startsWith('santashop-')),
			[`santashop-${target}/src/**/*.stories.ts`],
		);
		assert.ok(config.include.includes('.storybook/*.ts'));
		assert.ok(
			config.include.includes(
				`.storybook/${target === 'app' ? 'registration' : 'admin'}/**/*.ts`,
			),
		);
		assert.ok(config.include.includes('storybook-visual/**/*.ts'));
	}
});
