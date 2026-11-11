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
for (const filename of filenames) {
	const { template } = JSON.parse(
		readFileSync(new URL(filename, directory), 'utf8'),
	);
	test(`${filename}: shopper guidance matches account and visit rules`, () => {
		const english = template.language === 'en';
		const cancellation =
			template.deliveryProfile === 'registration-cancellation';
		const waitingList =
			template.deliveryProfile === 'waiting-list-capacity';
		for (const content of [template.html, template.textPart]) {
			assert.match(
				content,
				english
					? /Your username is the email address this message was sent to/
					: /Tu nombre de usuario es la dirección de correo electrónico a la que se envió este mensaje/,
			);
			assert.match(
				content,
				english
					? /We do not have access to your password/
					: /No tenemos acceso a tu contraseña/,
			);
			assert.doesNotMatch(content, /\{\{(?:email|username|password)\}\}/);
			if (cancellation) {
				assert.doesNotMatch(
					content,
					/rtd-denver|Parking is free|estacionamiento es gratuito|another adult|otro adulto/,
				);
			} else {
				assert.match(content, /https:\/\/www\.rtd-denver\.com\//);
				assert.match(
					content,
					english
						? /Parking is free/
						: /El estacionamiento es gratuito/,
				);
				if (!waitingList) {
					assert.match(
						content,
						english
							? /such as a birth certificate or a school or medical form/
							: /como un acta de nacimiento o un formulario escolar o médico/,
					);
					assert.match(
						content,
						english
							? /copy or photo of the birth certificate, not the original/
							: /copia o foto del acta de nacimiento, no el original/,
					);
					assert.match(
						content,
						english
							? /another adult.*your QR code, their own photo ID, and proof of each child’s age/
							: /otro adulto.*tu código QR, su propia identificación con foto y un comprobante de la edad de cada niño/,
					);
					assert.match(
						content,
						english
							? /view available appointments before changing your appointment/
							: /ver las citas disponibles antes de cambiar tu cita/,
					);
					assert.match(
						content,
						english
							? /Shoppers cannot cancel their own appointments/
							: /Los compradores no pueden cancelar sus propias citas/,
					);
				}
			}
		}
	});
}
