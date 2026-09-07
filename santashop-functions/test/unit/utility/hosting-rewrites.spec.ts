import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HostingRewrite {
	source: string;
	function?: { functionId?: string; region?: string };
	destination?: string;
}

interface FirebaseConfig {
	hosting?: Array<{ target?: string; rewrites?: HostingRewrite[] }>;
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
