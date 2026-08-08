import { firstValueFrom, of, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
	filterNil,
	inputIsNotNullOrUndefinedTypeGuard,
	pluckFilterNil,
} from './rxjs-helpers';

describe('rxjs helpers', () => {
	it('identifies nullish values', () => {
		expect(inputIsNotNullOrUndefinedTypeGuard(null)).toBe(false);
		expect(inputIsNotNullOrUndefinedTypeGuard(undefined)).toBe(false);
		expect(inputIsNotNullOrUndefinedTypeGuard(0)).toBe(true);
	});

	it('filters null and undefined while retaining falsey values', async () => {
		await expect(
			firstValueFrom(
				of(null, 0, undefined, false, '', 'value').pipe(
					filterNil(),
					toArray(),
				),
			),
		).resolves.toEqual([0, false, '', 'value']);
	});

	it('plucks a property and filters nullish source and property values', async () => {
		await expect(
			firstValueFrom(
				of(
					null,
					undefined,
					{} as { value?: string },
					{ value: 'kept' },
				).pipe(pluckFilterNil('value'), toArray()),
			),
		).resolves.toEqual(['kept']);
	});
});
