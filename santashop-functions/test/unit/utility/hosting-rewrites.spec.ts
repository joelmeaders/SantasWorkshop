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
