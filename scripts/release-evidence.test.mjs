import assert from 'node:assert/strict';
import test from 'node:test';
import {
	fixture,
	releaseSha,
	workflowSha,
	repository,
} from './release-fixtures.mjs';
import {
	githubApi,
	verifyRelease,
	releaseSummary,
} from './release-evidence.mjs';

for (const unit of ['app', 'admin', 'functions']) {
	test(`${unit}: resolves the commit without searching other workflow runs`, async () => {
		const f = fixture(unit);
		const requests = [];
		const result = await verifyRelease(f.options, async (path) => {
			requests.push(path);
			return f.api(path);
		});
		assert.equal(result.sha, releaseSha);
		assert.deepEqual(requests, [
			`commits/${releaseSha}`,
			`compare/${releaseSha}...master`,
		]);
		assert.equal(result.skipTests, false);
		assert.match(releaseSummary(result), /Production waits/);
	});
	test(`${unit}: owner can skip tests without old test evidence`, async () => {
		const f = fixture(unit);
		const result = await verifyRelease(
			{ ...f.options, skipTests: true },
			f.api,
		);
		assert.equal(result.skipTests, true);
		assert.match(releaseSummary(result), /SKIPPED by owner joelmeaders/);
	});
}
for (const releaseRef of [
	'master',
	'v2026.09',
	'refs/tags/rollback',
	releaseSha.slice(0, 12),
]) {
	test(`resolve ${releaseRef} once`, async () => {
		const f = fixture();
		let resolutions = 0;
		const result = await verifyRelease(
			{ ...f.options, releaseRef },
			async (path) => {
				if (path === `commits/${encodeURIComponent(releaseRef)}`)
					return {
						sha: ++resolutions === 1 ? releaseSha : workflowSha,
					};
				return f.api(path);
			},
		);
		assert.equal(resolutions, 1);
		assert.equal(result.sha, releaseSha);
	});
}
for (const [overrides, pattern] of [
	[{ releaseRef: '' }, /Select a release/],
	[{ releaseRef: 'invalid ref' }, /Select a release/],
	[{ releaseRef: 'a'.repeat(1025) }, /Select a release/],
	[{ unit: 'unknown' }, /Invalid release/],
	[{ mode: 'unknown' }, /Invalid release/],
	[{ repository: '../other/repo' }, /Invalid repository/],
	[
		{
			workflowRef: `${repository}/.github/workflows/functions-test-and-prod-release.yml@refs/heads/feature`,
		},
		/from master/,
	],
	[{ skipTests: 'true' }, /boolean/],
	[{ skipTests: true, actor: 'other' }, /repository owner/],
])
	test(`invalid release input ${JSON.stringify(overrides)} stops before API access`, async () => {
		const f = fixture();
		let called = false;
		await assert.rejects(
			verifyRelease({ ...f.options, ...overrides }, async () => {
				called = true;
			}),
			pattern,
		);
		assert.equal(called, false);
	});
for (const status of ['behind', 'diverged', 'unknown'])
	test(`reject commit off master: ${status}`, async () => {
		const f = fixture();
		await assert.rejects(
			verifyRelease(f.options, async (path) =>
				path.startsWith('compare/') ? { status } : f.api(path),
			),
			/on master/,
		);
	});
for (const sha of ['short', workflowSha, undefined])
	test(`reject wrong immutable SHA ${sha}`, async () => {
		const f = fixture();
		await assert.rejects(
			verifyRelease(f.options, async () => ({ sha })),
			/immutable commit/,
		);
	});
for (const status of [403, 404, 429, 500])
	test(`API failure ${status} stops selection`, async () => {
		const api = githubApi('fixture-token', repository, async () => ({
			ok: false,
			status,
		}));
		await assert.rejects(
			verifyRelease(fixture().options, api),
			new RegExp(`HTTP ${status}`),
		);
	});
test('network failure stops selection', async () => {
	const api = githubApi('fixture-token', repository, async () => {
		throw new Error('offline');
	});
	await assert.rejects(verifyRelease(fixture().options, api), /connectivity/);
});

for (const [commitMessage, skipped] of [
	['Urgent repair [skip tests]', true],
	['Urgent repair [SKIP TESTS]\nDetails', true],
	['Add emergency releases\n\nDocuments the [skip tests] option', false],
	['Add emergency releases\r\n\r\nDocuments [skip tests]', false],
])
	test(`commit subject controls test skips: ${JSON.stringify(commitMessage)}`, async () => {
		const f = fixture();
		const result = await verifyRelease(
			{ ...f.options, commitMessage },
			f.api,
		);
		assert.equal(result.skipTests, skipped);
	});
