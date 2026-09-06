import { describe, expect, it } from 'vitest';
import { formatRegistrationDateTime } from '../../../src/utility/date-time-format';
describe('localized appointment dates', () => {
	it.each(['en', 'es'] as const)(
		'uses Denver daylight saving and standard time for %s',
		(language) => {
			expect(
				formatRegistrationDateTime(
					new Date('2026-07-12T18:00:00Z'),
					language,
				),
			).toContain('12:00');
			expect(
				formatRegistrationDateTime(
					{ toDate: () => new Date('2026-12-12T18:00:00Z') },
					language,
				),
			).toContain('11:00');
			expect(
				formatRegistrationDateTime('2026-12-12T18:00:00Z', language),
			).toContain(language === 'es' ? 'diciembre' : 'December');
		},
	);
});
