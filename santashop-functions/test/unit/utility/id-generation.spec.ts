import { describe, expect, it, vi } from 'vitest';
import { generateId } from '../../../src/utility/id-generation';

describe('id-generation utility', () => {
	it('creates IDs with the requested length', () => {
		const generatedId = generateId(8);

		expect(generatedId).toHaveLength(8);
	});

	it('uses only supported alphabet and number characters', () => {
		const generatedId = generateId(64);

		expect(generatedId).toMatch(/^[A-HJ-NP-Z2-9]+$/u);
	});

	it('builds deterministic output when randomness is stubbed', () => {
		const randomSpy = vi
			.spyOn(Math, 'random')
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0.1)
			.mockReturnValueOnce(0.2)
			.mockReturnValueOnce(0.3);

		const generatedId = generateId(4);

		expect(generatedId).toHaveLength(4);
		expect(generatedId).toBe('ADGK');
		randomSpy.mockRestore();
	});
});
