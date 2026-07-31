import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface FirebaseFunctionsConfig {
	functions?: {
		runtime?: string;
		source?: string;
	};
}

const readJson = <T>(relativePath: string): T =>
	JSON.parse(
		readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
	) as T;

describe('Firebase Functions runtime configuration', () => {
	it('keeps the dedicated e2e config on the deployed Functions runtime', () => {
		const standardConfig = readJson<FirebaseFunctionsConfig>(
			'../../../../firebase.json',
		);
		const e2eConfig = readJson<FirebaseFunctionsConfig>(
			'../../../../firebase.e2e.json',
		);

		expect(standardConfig.functions?.runtime).toBe('nodejs22');
		expect(e2eConfig.functions).toEqual({
			source: 'santashop-functions',
			runtime: standardConfig.functions?.runtime,
		});
	});
});
