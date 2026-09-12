import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { changesBetween } from './ci-changes.mjs';

test('PR merge-base excludes unrelated master changes and renames include old consumers', () => {
	const directory = mkdtempSync(join(tmpdir(), 'santashop-ci-diff-'));
	const git = (args) =>
		execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
	const commit = (name) => {
		git(['add', '.']);
		git([
			'-c',
			'user.name=CI Test',
			'-c',
			'user.email=ci@example.invalid',
			'commit',
			'-m',
			name,
		]);
		return git(['rev-parse', 'HEAD']).trim();
	};
	try {
		git(['init', '-b', 'master']);
		mkdirSync(join(directory, 'santashop-app'));
		mkdirSync(join(directory, 'santashop-admin'));
		writeFileSync(join(directory, 'santashop-app', 'a.ts'), 'initial');
		const base = commit('base');
		git(['checkout', '-b', 'feature']);
		writeFileSync(join(directory, 'santashop-app', 'a.ts'), 'app');
		const head = commit('app');
		git(['checkout', 'master']);
		writeFileSync(join(directory, 'santashop-admin', 'a.ts'), 'admin');
		const master = commit('admin');
		assert.deepEqual(
			changesBetween(master, head, 'pull_request', git).deploy,
			['app'],
		);
		assert.deepEqual(changesBetween(base, master, 'push', git).deploy, [
			'admin',
		]);
		git(['checkout', 'feature']);
		mkdirSync(join(directory, 'santashop-admin'), { recursive: true });
		git(['mv', 'santashop-app/a.ts', 'santashop-admin/a.ts']);
		const moved = commit('move');
		assert.deepEqual(changesBetween(head, moved, 'push', git).deploy, [
			'app',
			'admin',
		]);
	} finally {
		assert.ok(directory.startsWith(join(tmpdir(), 'santashop-ci-diff-')));
		rmSync(directory, { recursive: true, force: true });
	}
});
test('invalid comparison SHAs fail instead of returning no changes', () => {
	for (const base of ['', 'HEAD', '0'.repeat(40)])
		assert.throws(
			() => changesBetween(base, 'a'.repeat(40), 'push'),
			/full commit SHAs/,
		);
});
