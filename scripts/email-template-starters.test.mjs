import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const directory = new URL(
	'../santashop-admin/src/assets/email-templates/2026/',
	import.meta.url,
);
const filenames = readdirSync(directory).filter((name) =>
	name.endsWith('.json'),
);

test('the complete bilingual starter set is present', () => {
	assert.deepEqual(
		filenames.sort(),
		[
			'event-reminder',
			'registration-cancellation',
			'registration-confirmation',
			'waiting-list-capacity',
		]
			.flatMap((profile) =>
				['en', 'es'].map(
					(language) => `${profile}-2026-${language}.json`,
				),
			)
			.sort(),
	);
});

for (const filename of filenames) {
	const { template } = JSON.parse(
		readFileSync(new URL(filename, directory), 'utf8'),
	);
	test(`${filename}: current seasonal content and runtime mappings`, () => {
		const cancellation =
			template.deliveryProfile === 'registration-cancellation';
		const waitingList =
			template.deliveryProfile === 'waiting-list-capacity';
		for (const content of [template.html, template.textPart]) {
			assert.doesNotMatch(
				content,
				/TODO|TBD|TO BE CONFIRMED|POR CONFIRMAR|BORRADOR|DRAFT|not yet confirmed|South Lowry|7150|Leetsdale|80224|undefined|10\s*(?:am|a\.m\.|:00)\s*(?:to|[-–])\s*3/i,
			);
			assert.match(content, /\{\{registrationUrl\}\}/);
			assert.doesNotMatch(
				content,
				/https:\/\/(?:test|register|admin)\.denversantaclausshop\.org/,
			);
			if (cancellation) {
				assert.doesNotMatch(
					content,
					/1812|Brighton|35th|google\.com\/maps|\{\{(?:qrCodeUrl|code)\}\}/,
				);
				assert.match(content, /\{\{dateTime\}\}/);
			} else {
				assert.match(content, /1812 35th Street, Denver, CO 80216/);
				assert.match(content, /Brighton Blvd/);
				assert.match(
					content,
					template.language === 'en'
						? /west side, off Brighton Blvd/
						: /lado oeste, con entrada por Brighton Blvd/,
				);
				assert.match(
					content,
					template.language === 'en'
						? /December 11, 12, 14, and 15, 2026/
						: /11, 12, 14 y 15 de diciembre de 2026/,
				);
				if (!waitingList) {
					assert.match(content, /\{\{dateTime\}\}/);
					assert.match(
						content,
						/1812%2035th%20Street%20Denver%20CO%2080216/,
					);
				}
			}
			const mapped = template.fieldMappings.map(({ name }) => name);
			for (const [, name] of content.matchAll(/\{\{(\w+)\}\}/g))
				assert.ok(mapped.includes(name), `Unmapped ${name}`);
		}
		for (const { name, mapping } of template.fieldMappings)
			assert.equal(mapping, name);
		assert.equal(template.seasonalReviewRequired, true);
		assert.equal(template.seasonalDetailsReviewed, false);
		if (waitingList) {
			assert.match(template.html, /\{\{waitingListUrl\}\}/);
			assert.match(template.textPart, /\{\{waitingListUrl\}\}/);
			assert.match(
				template.textPart,
				template.language === 'en'
					? /does not save a spot/
					: /no reserva un lugar/,
			);
		}
	});
}
