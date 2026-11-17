import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	ADMIN_REVIEW_CALLABLES,
	verifyHostedAdminCallables,
} from './verify-admin-hosted-callables.mjs';

const sha = '1'.repeat(40);
const admin = ['--project', 'santas-workshop-test', '--admin-test-sha', sha];
const review = [
	...admin,
	'--scope',
	'registration-review',
	'--functions-test-sha',
	sha,
];
const reset = [...admin, '--scope', 'reset-only'];
const testOrigin = 'https://santas-workshop-test.web.app';
const rejection = () =>
	Response.json(
		{ error: { status: 'INVALID_ARGUMENT', message: 'Bad Request' } },
		{ status: 400 },
	);

test('probes reset and review routes with harmless, bounded GET requests only', async () => {
	const seen = [];
	const response = await verifyHostedAdminCallables(
		review,
		async (url, options) => {
			const parsed = new URL(url);
			assert.equal(parsed.origin, testOrigin);
			assert.equal(parsed.search, '');
			assert.equal(options.method, 'GET');
			assert.equal(options.body, undefined);
			assert.deepEqual(options.headers, { Accept: 'application/json' });
			assert.equal(options.redirect, 'error');
			assert.ok(options.signal instanceof AbortSignal);
			seen.push(parsed.pathname);
			return rejection();
		},
	);
	assert.deepEqual(seen, [
		'/requestPasswordReset',
		...ADMIN_REVIEW_CALLABLES.map((name) => '/' + name),
	]);
	assert.deepEqual(response.paths, seen);
	assert.equal(response.sha, sha);
});

test('reset-only does not probe review or require a Functions TEST deployment', async () => {
	const result = await verifyHostedAdminCallables(reset, async (url) => {
		assert.equal(url, testOrigin + '/requestPasswordReset');
		return rejection();
	});
	assert.deepEqual(result.paths, ['/requestPasswordReset']);
});

test('does not fetch if stage, scope, or matched exact TEST deployment inputs are missing', async () => {
	const noFetch = async () =>
		assert.fail('Must validate input before fetching.');
	for (const [args, message] of [
		[
			['--project', 'santas-workshop-193b5', '--scope', 'reset-only'],
			/TEST project/,
		],
		[admin, /Choose --scope/],
		[
			['--project', 'santas-workshop-test', '--scope', 'reset-only'],
			/Admin TEST deployment SHA/,
		],
		[[...admin, '--scope', 'registration-review'], /same exact SHA/],
		[
			[
				...admin,
				'--scope',
				'registration-review',
				'--functions-test-sha',
				'2'.repeat(40),
			],
			/same exact SHA/,
		],
		[[...reset, '--url', 'https://example.test'], /Unknown option/],
	])
		await assert.rejects(
			verifyHostedAdminCallables(args, noFetch),
			message,
		);
});

test('rejects SPA fallback, a non-callable JSON result, and request failures', async () => {
	await assert.rejects(
		verifyHostedAdminCallables(
			reset,
			async () =>
				new Response('<html>Admin SPA</html>', {
					headers: { 'content-type': 'text/html' },
				}),
		),
		/\/requestPasswordReset: expected callable HTTP 400 application\/json; got 200 text\/html/,
	);
	await assert.rejects(
		verifyHostedAdminCallables(reset, async () =>
			Response.json(
				{ error: { status: 'PERMISSION_DENIED' } },
				{ status: 400 },
			),
		),
		/expected the callable invalid-method rejection/,
	);
	await assert.rejects(
		verifyHostedAdminCallables(reset, async () => {
			throw new Error('Synthetic connection error');
		}),
		/request failed or timed out/,
	);
});
