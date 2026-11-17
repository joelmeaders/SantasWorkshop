import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const ADMIN_REVIEW_CALLABLES = Object.freeze([
	'listRegistrationReviewCases',
	'getRegistrationReviewCase',
	'setRegistrationReviewStatus',
	'addRegistrationReviewNote',
	'performRegistrationReviewAction',
]);

const TEST_PROJECT = 'santas-workshop-test';
const TEST_ADMIN_ORIGIN = 'https://santas-workshop-test.web.app';
const COMMIT_SHA = /^[a-f0-9]{40}$/u;

export function parseHostedAdminSmokeArgs(args) {
	const { values } = parseArgs({
		args,
		options: {
			project: { type: 'string' },
			scope: { type: 'string' },
			'admin-test-sha': { type: 'string' },
			'functions-test-sha': { type: 'string' },
		},
	});
	if (values.project !== TEST_PROJECT)
		throw new Error('Choose the TEST project: santas-workshop-test.');
	if (values.scope !== 'reset-only' && values.scope !== 'registration-review')
		throw new Error(
			'Choose --scope reset-only or --scope registration-review.',
		);
	const admin = values['admin-test-sha'];
	if (!admin || !COMMIT_SHA.test(admin))
		throw new Error(
			'Supply the verified successful Admin TEST deployment SHA.',
		);
	const functions = values['functions-test-sha'];
	if (values.scope === 'registration-review' && functions !== admin)
		throw new Error(
			'Registration Review requires successful Admin and Functions TEST deployments of the same exact SHA.',
		);
	return { scope: values.scope, sha: admin };
}

export async function verifyHostedAdminCallables(args, fetcher = fetch) {
	const { scope, sha } = parseHostedAdminSmokeArgs(args);
	const endpoints =
		scope === 'reset-only'
			? ['requestPasswordReset']
			: ['requestPasswordReset', ...ADMIN_REVIEW_CALLABLES];
	const results = await Promise.allSettled(
		endpoints.map(async (callable) => {
			const path = '/' + callable;
			const response = await fetcher(TEST_ADMIN_ORIGIN + path, {
				method: 'GET',
				headers: { Accept: 'application/json' },
				redirect: 'error',
				signal: AbortSignal.timeout(8_000),
			}).catch((error) => {
				throw new Error(path + ': request failed or timed out.', {
					cause: error,
				});
			});
			const type = response.headers
				.get('content-type')
				?.split(';')[0]
				.trim()
				.toLowerCase();
			if (response.status !== 400 || type !== 'application/json')
				throw new Error(
					path +
						': expected callable HTTP 400 application/json; got ' +
						response.status +
						' ' +
						(type ?? '(no content type)') +
						'.',
				);
			const payload = await response.json().catch(() => null);
			if (payload?.error?.status !== 'INVALID_ARGUMENT')
				throw new Error(
					path + ': expected the callable invalid-method rejection.',
				);
			return path;
		}),
	);
	const failures = results.flatMap((result) =>
		result.status === 'rejected' ? [result.reason.message] : [],
	);
	if (failures.length) throw new Error(failures.join('\n'));
	return {
		sha,
		origin: TEST_ADMIN_ORIGIN,
		paths: results.flatMap((result) =>
			result.status === 'fulfilled' ? [result.value] : [],
		),
	};
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const result = await verifyHostedAdminCallables(process.argv.slice(2));
		for (const path of result.paths)
			console.log('PASS ' + result.origin + path);
		console.log(
			'TEST callable routing verified. Supplied deployment SHA: ' +
				result.sha +
				' (no authentication or reset submitted).',
		);
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: 'Admin TEST callable routing probe failed.',
		);
		process.exitCode = 1;
	}
}
