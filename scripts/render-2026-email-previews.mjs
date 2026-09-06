import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import Handlebars from 'handlebars';

const source = fileURLToPath(
	new URL(
		'../santashop-admin/src/assets/email-templates/2026/',
		import.meta.url,
	),
);
const output = fileURLToPath(
	new URL('../.artifacts/email-templates-2026/', import.meta.url),
);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
	for (const name of readdirSync(source).filter((file) =>
		file.endsWith('.json'),
	)) {
		const { template } = JSON.parse(readFileSync(source + name, 'utf8'));
		const data = Object.fromEntries(
			template.fieldMappings.map((field) => [
				field.name,
				field.sampleValue,
			]),
		);
		data.firstName =
			template.language === 'es'
				? 'María José Rodríguez'
				: 'Alexandra-Michelle';
		const html = Handlebars.compile(template.html)(data);
		writeFileSync(output + template.key + '.html', html);
		for (const [label, width] of [
			['desktop', 800],
			['mobile', 360],
		]) {
			const page = await browser.newPage({
				viewport: { width, height: 900 },
			});
			await page.goto(
				pathToFileURL(output + template.key + '.html').href,
			);
			const logoLoaded = await page
				.locator('img[src$="/dscs_logo_email.png"]')
				.evaluate((img) => img.complete && img.naturalWidth > 0);
			if (!logoLoaded)
				throw new Error('The original DSCS logo did not load.');
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth > window.innerWidth,
			);
			if (overflow)
				throw new Error(
					`Horizontal overflow in ${template.key} at ${width}px`,
				);
			await page.screenshot({
				path: output + template.key + '-' + label + '.png',
				fullPage: true,
			});
			await page
				.locator('img')
				.evaluateAll((images) =>
					images.forEach((image) => image.removeAttribute('src')),
				);
			if (
				!(await page.locator('body').innerText()).includes(
					data.firstName,
				)
			)
				throw new Error('Missing greeting with images blocked.');
			if (
				template.deliveryProfile !== 'registration-cancellation' &&
				!(await page.locator('body').innerText()).includes(data.code)
			)
				throw new Error('Missing text ticket with images blocked.');
			await page.close();
		}
		results.push({
			key: template.key,
			language: template.language,
			widths: [360, 800],
			horizontalOverflow: false,
			imagesBlockedText: 'passed',
		});
	}
} finally {
	await browser.close();
}
writeFileSync(output + 'results.json', JSON.stringify(results, null, 2));
writeFileSync(
	output + 'index.html',
	`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>2026 email collection</title><body style="background:#eee8de;color:#243c34;font-family:Arial;padding:24px"><h1>2026 email collection</h1><p>Drafts for review. The venue and opening details are unconfirmed. All QR codes and appointments are fictional preview data.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px">${results.map(({ key }) => `<article><h2 style="font-size:18px">${key}</h2><a href="${key}.html">Open email</a><br><a href="${key}-mobile.png">Phone screenshot</a><br><img alt="Preview of ${key}" src="${key}-desktop.png" style="width:100%;max-width:400px;border:1px solid #ddccb3"></article>`).join('')}</div></body></html>`,
);
console.log(
	`Rendered and checked ${results.length} templates at desktop and phone widths: ${output}`,
);
