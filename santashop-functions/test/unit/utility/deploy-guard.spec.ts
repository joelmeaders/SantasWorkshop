import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const deployGuard = requireFromTest(
	'../../../../scripts/assert-functions-deploy-ci.cjs',
) as {
	assertFunctionsDeployFromCi: (
		env: Record<string, string | undefined>,
	) => string;
};

describe('Firebase Functions deploy guard', () => {
	it('rejects direct local deployments', () => {
		expect(() =>
			deployGuard.assertFunctionsDeployFromCi({
				SANTASHOP_FUNCTIONS_DEPLOY: 'test',
			}),
		).toThrow('Firebase Functions deployments are GitHub Actions-only');
	});

	it('requires an explicit deploy target in GitHub Actions', () => {
		expect(() =>
			deployGuard.assertFunctionsDeployFromCi({
				GITHUB_ACTIONS: 'true',
			}),
		).toThrow(
			'SANTASHOP_FUNCTIONS_DEPLOY must explicitly identify the GitHub Actions deploy target',
		);
	});

	it.each(['test', 'prod'])(
		'allows the %s GitHub Actions target',
		(target) => {
			expect(
				deployGuard.assertFunctionsDeployFromCi({
					GITHUB_ACTIONS: 'true',
					SANTASHOP_FUNCTIONS_DEPLOY: target,
				}),
			).toBe(target);
		},
	);

	it('rejects an unknown GitHub Actions target', () => {
		expect(() =>
			deployGuard.assertFunctionsDeployFromCi({
				GITHUB_ACTIONS: 'true',
				SANTASHOP_FUNCTIONS_DEPLOY: 'local',
			}),
		).toThrow(
			'SANTASHOP_FUNCTIONS_DEPLOY must explicitly identify the GitHub Actions deploy target',
		);
	});
});
