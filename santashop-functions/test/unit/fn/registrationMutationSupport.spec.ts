import { describe, expect, it } from 'vitest';
import { ToyType } from '@santashop/models';
import {
	canonicalizeChild,
	getStoredMutationResult,
	requireEnabledCurrentSlot,
	requireMutationId,
	requireObject,
	requireOpenPreRegistration,
} from '../../../src/fn/registrationMutationSupport';

describe('registration mutation support', () => {
	it('rejects malformed request envelopes and mutation IDs', () => {
		expect(() => requireObject([])).toThrow(/Request data must be an object/);
		expect(() => requireMutationId('short')).toThrow(/Mutation ID must contain/);
		expect(() => requireOpenPreRegistration(undefined)).toThrow(
			/Pre-registration is currently unavailable/,
		);
	});

	it('rejects a reused mutation ID for a different operation', () => {
		expect(() =>
			getStoredMutationResult(
				{ operation: 'saveDraftChild', result: true, completedOn: new Date() },
				'undoRegistration',
			),
		).toThrow(/already used for a different operation/);
	});

	it('canonicalizes children and applies age-appropriate toy validation', () => {
		const child = canonicalizeChild({
			id: 2,
			firstName: ' Noelle ',
			lastName: ' Elf ',
			dateOfBirth: new Date(new Date().getFullYear() - 5, 5, 10),
			toyType: ToyType.girl,
		});
		expect(child).toMatchObject({ id: 2, firstName: 'Noelle', lastName: 'Elf', toyType: ToyType.girl });
		expect(() => canonicalizeChild({
			id: 3,
			firstName: 'Baby',
			lastName: 'Elf',
			dateOfBirth: new Date(new Date().getFullYear() - 1, 5, 10),
			toyType: ToyType.girl,
		})).toThrow(/Infant children must use the infant toy type/);
	});

	it('requires a current enabled appointment slot', () => {
		expect(() => requireEnabledCurrentSlot(undefined, 'slot')).toThrow(/no longer exists/);
		expect(() => requireEnabledCurrentSlot({ id: 'slot', programYear: 2020, enabled: false } as never, 'slot')).toThrow(/no longer available/);
		expect(() => requireEnabledCurrentSlot({ id: 'slot', programYear: 2025, enabled: true } as never, 'slot')).toThrow(/invalid/);
	});
});
