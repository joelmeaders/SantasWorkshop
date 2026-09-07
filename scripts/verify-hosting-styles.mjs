import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [indexPath] = process.argv.slice(2);
assert.ok(
	indexPath,
	'Usage: node scripts/verify-hosting-styles.mjs <index.html>',
);

// Firebase Hosting blocks inline script handlers. Critical CSS extraction emits
// media="print" with an onload handler, which leaves lazy routes unstyled.
const html = (await readFile(indexPath, 'utf8')).replace(
	/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
	'',
);
const stylesheets = [...html.matchAll(/<link\b[^>]*>/gi)]
	.map(([tag]) => tag)
	.filter((tag) => /\brel\s*=\s*["']stylesheet["']/i.test(tag));

assert.ok(stylesheets.length, `${indexPath}: no active stylesheet links found`);
for (const tag of stylesheets) {
	assert.doesNotMatch(
		tag,
		/\bon\w+\s*=/i,
		`${indexPath}: stylesheet requires an inline handler blocked by Hosting CSP`,
	);
	const media = tag.match(/\bmedia\s*=\s*["']([^"']*)["']/i)?.[1];
	assert.ok(
		!media || ['all', 'screen'].includes(media.toLowerCase()),
		`${indexPath}: stylesheet does not apply to the screen (media=${media})`,
	);
}
console.log(`${indexPath}: global styles load without inline script handlers.`);
