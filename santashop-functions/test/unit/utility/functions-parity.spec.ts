import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const parity = requireFromTest('../../../../scripts/verify-functions-parity.cjs') as {
	compareFunctionIds: (
		expected: string[],
		actual: string[],
	) => { missing: string[]; unexpected: string[] };
	deployedFunctionIds: (output: unknown) => string[];
	sourceFunctionIds: (source: string) => string[];
	verifyFunctionsParity: (source: string, output: unknown) => string[];
};

describe('Functions deployment parity', () => {
	it('excludes emulator-only exports from the production inventory', () => {
		const source = [
			'export const liveA = onCall({}, handler);',
			'export const liveB = onSchedule({}, handler);',
			'// ------------------------------------- TEST HELPER FUNCTIONS (Emulator Only)',
			'export const testSeed = emulatorOnly(() => onCall({}, handler));',
		].join('\n');

		expect(parity.sourceFunctionIds(source)).toEqual(['liveA', 'liveB']);
	});

	it('reads the Firebase CLI JSON result shape', () => {
		expect(
			parity.deployedFunctionIds({
				status: 'success',
				result: [{ id: 'second' }, { id: 'first' }],
			}),
		).toEqual(['first', 'second']);
	});

	it('reports missing and retired live functions', () => {
		expect(
			parity.compareFunctionIds(['current', 'missing'], ['current', 'retired']),
		).toEqual({ missing: ['missing'], unexpected: ['retired'] });
	});

	it('passes only when production exports and live functions match', () => {
		const source = 'export const current = onCall({}, handler);';
		expect(
			parity.verifyFunctionsParity(source, {
				result: [{ id: 'current' }],
			}),
		).toEqual(['current']);
	});
});
