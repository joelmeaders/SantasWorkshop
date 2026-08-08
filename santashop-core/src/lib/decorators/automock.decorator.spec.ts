import { describe, expect, it } from 'vitest';
import { AUTOMOCK_COLLECTION, automock } from './automock.decorator';

describe('automock', () => {
	it('records decorated member names in declaration order', () => {
		const target = {};

		automock(target, 'first');
		automock(target, 'second');

		expect(Reflect.get(target, AUTOMOCK_COLLECTION)).toEqual([
			'first',
			'second',
		]);
		expect(Object.prototype.propertyIsEnumerable.call(target, AUTOMOCK_COLLECTION)).toBe(
			true,
		);
	});
});
