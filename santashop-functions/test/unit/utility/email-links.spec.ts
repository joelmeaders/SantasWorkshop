import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe('email registration links', () => {
	it.each([
		'https://test.denversantaclausshop.org/',
		'https://register.denversantaclausshop.org/',
		'http://localhost:4100/',
	])(
		'uses the configured customer site %s for every legacy app origin',
		async (root) => {
			vi.stubEnv(
				'SANTASHOP_PASSWORD_RESET_CONTINUE_URL',
				`${root}?mode=sign-in`,
			);
			vi.resetModules();
			const { normalizeEmailAppLinks } =
				await import('../../../src/utility/email-links');
			for (const origin of [
				'https://test.denversantaclausshop.org',
				'https://register.denversantaclausshop.org',
				'https://santashop-app-test.web.app',
				'https://santashop-app-test.firebaseapp.com',
				'https://santas-workshop-193b5.web.app',
				'https://santas-workshop-193b5.firebaseapp.com',
			]) {
				expect(
					normalizeEmailAppLinks(
						`<a href="${origin}/">Register</a> ${origin}`,
					),
				).toBe(`<a href="${root}">Register</a> ${root}`);
				expect(
					normalizeEmailAppLinks(
						`${origin}/pre-registration/overview?mode=sign-in#ticket`,
					),
				).toBe(`${root}pre-registration/overview?mode=sign-in#ticket`);
				expect(
					normalizeEmailAppLinks(`${origin}/`, '{{registrationUrl}}'),
				).toBe('{{registrationUrl}}');
			}
		},
	);

	it('leaves public resources, admin sites, and unrelated hosts unchanged', async () => {
		const { normalizeEmailAppLinks } =
			await import('../../../src/utility/email-links');
		const content = [
			'https://www.denversantaclausshop.org/faq-espanol/',
			'https://www.facebook.com/denversantaclausshop/',
			'https://www.google.com/maps/search/?api=1&query=Denver',
			'https://storage.googleapis.com/santas-workshop-193b5.appspot.com/public/dscs_logo_email.png',
			'https://santas-workshop-test.web.app/',
			'https://register.denversantaclausshop.org.example.com/',
			'https://test.denversantaclausshop.org@other.example/',
		].join('\n');
		expect(normalizeEmailAppLinks(content)).toBe(content);
	});
});
