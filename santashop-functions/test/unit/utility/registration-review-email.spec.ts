import { describe, expect, it } from 'vitest';
import {
	renderReviewEmail,
	reviewEmailActions,
} from '../../../src/utility/registration-review-email';

describe('shopper review email templates', () => {
	it.each(reviewEmailActions)(
		'renders a dedicated bilingual notice for %s',
		(action) => {
			const english = renderReviewEmail(action, 'en', 'Jamie', '');
			const spanish = renderReviewEmail(action, 'es', 'Jamie', '');
			expect(english.replyTo).toBe('president@denversantaclausshop.org');
			expect(spanish.replyTo).toBe(english.replyTo);
			expect(english.subject).not.toBe(spanish.subject);
			expect(english.paragraphs).toHaveLength(3);
			expect(english.text).toMatch(/^Hello Jamie,/u);
			expect(spanish.text).toMatch(/^Hola Jamie,/u);
			expect(english.text).not.toMatch(/reason|internal note/iu);
		},
	);

	it('uses the shopper message as an escaped extra paragraph, never rendered code', () => {
		const preview = renderReviewEmail(
			'contact',
			'en',
			'Jo & Dana',
			'We can help.\n<script>ignored</script>',
		);
		expect(preview.text).toContain(
			'We can help.\n<script>ignored</script>',
		);
		expect(preview.html).toContain('Jo &amp; Dana');
		expect(preview.html).toContain(
			'We can help.<br>&lt;script&gt;ignored&lt;/script&gt;',
		);
		expect(preview.html).not.toContain('<script>');
	});
});
