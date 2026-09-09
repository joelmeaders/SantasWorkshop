import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HostingRewrite {
	source: string;
	function?: { functionId?: string; region?: string };
	destination?: string;
}

interface FirebaseConfig {
	hosting?: Array<{
		target?: string;
		rewrites?: HostingRewrite[];
		headers?: Array<{
			source: string;
			headers: Array<{ key: string; value: string }>;
		}>;
	}>;
}

const config = JSON.parse(
	readFileSync(new URL('../../../../firebase.json', import.meta.url), 'utf8'),
) as FirebaseConfig;

const hostingWorkflowPaths = [
	'app-pr-validation.yml',
	'app-test-and-prod-release.yml',
	'admin-pr-validation.yml',
	'admin-test-and-prod-release.yml',
];

describe('Customer hosting rewrites', () => {
	it('routes requestPasswordReset before the SPA fallback', () => {
		const customer = config.hosting?.find(
			(site) => site.target === 'santashop-app',
		);
		const rewrites = customer?.rewrites ?? [];
		const resetRewriteIndex = rewrites.findIndex(
			(rewrite) => rewrite.source === '/requestPasswordReset',
		);

		expect(rewrites[resetRewriteIndex]).toEqual({
			source: '/requestPasswordReset',
			function: {
				functionId: 'requestPasswordReset',
				region: 'us-central1',
			},
		});
		expect(resetRewriteIndex).toBeGreaterThanOrEqual(0);
		expect(resetRewriteIndex).toBeLessThan(rewrites.length - 1);
		expect(rewrites.at(-1)).toEqual({
			source: '**',
			destination: '/index.html',
		});
	});
});

describe('Admin hosting rewrites', () => {
	it('routes both public settings callables before the SPA fallback', () => {
		const admin = config.hosting?.find(
			(site) => site.target === 'santashop-admin',
		);
		const rewrites = admin?.rewrites ?? [];
		const settingsRewrites = rewrites.filter((rewrite) =>
			[
				'readPublicParametersSettings',
				'publishPublicParametersSettings',
			].includes(rewrite.function?.functionId ?? ''),
		);

		expect(settingsRewrites).toEqual([
			{
				source: '/readPublicParametersSettings',
				function: {
					functionId: 'readPublicParametersSettings',
					region: 'us-central1',
				},
			},
			{
				source: '/publishPublicParametersSettings',
				function: {
					functionId: 'publishPublicParametersSettings',
					region: 'us-central1',
				},
			},
		]);
		expect(rewrites.at(-1)).toEqual({
			source: '**',
			destination: '/index.html',
		});
	});
});

describe('Hosting workflow triggers', () => {
	it.each(hostingWorkflowPaths)(
		'runs %s when firebase.json changes',
		(workflowName) => {
			const workflow = readFileSync(
				new URL(
					`../../../../.github/workflows/${workflowName}`,
					import.meta.url,
				),
				'utf8',
			);

			expect(workflow).toContain("      - 'firebase.json'");
		},
	);
});

describe('Hosting service-worker script requests', () => {
	it.each(['santashop-app', 'santashop-admin'])(
		'allows worker fetches for the external scripts used by %s',
		(target) => {
			const site = config.hosting?.find(
				(entry) => entry.target === target,
			);
			const policy = site?.headers
				?.find((entry) => entry.source === '**')
				?.headers.find(
					(header) => header.key === 'Content-Security-Policy',
				)?.value;
			expect(policy).toBeDefined();
			const directives = new Map(
				(policy ?? '').split(';').map((directive) => {
					const [name, ...sources] = directive.trim().split(/\s+/);
					return [name, sources] as const;
				}),
			);
			// Angular's worker uses fetch even for script requests. script-src alone
			// permits the first page load but fails once the worker controls the page.
			for (const origin of [
				'https://www.gstatic.com',
				'https://www.googletagmanager.com',
			]) {
				expect(directives.get('script-src')).toContain(origin);
				expect(directives.get('connect-src')).toContain(origin);
			}
			expect(directives.get('connect-src')).not.toContain('*');
		},
	);
});
