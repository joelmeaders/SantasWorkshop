import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const sourceRoot = resolve('santashop-admin/src/assets');
const outputRoot = resolve(process.argv[2] ?? 'dist/santashop-admin', 'assets');
const files = await readdir(sourceRoot, {
	recursive: true,
	withFileTypes: true,
});
let verified = 0;

for (const file of files) {
	if (!file.isFile() || file.name.startsWith('.')) continue;
	const sourcePath = join(file.parentPath, file.name);
	const relativePath = relative(sourceRoot, sourcePath);
	const outputPath = join(outputRoot, relativePath);
	let actual;
	try {
		actual = await readFile(outputPath);
	} catch (error) {
		throw new Error(
			`Missing admin asset in build output: ${relativePath}`,
			{
				cause: error,
			},
		);
	}
	assert.deepEqual(
		actual,
		await readFile(sourcePath),
		`Admin asset differs from source: ${relativePath}`,
	);
	verified++;
}

assert.ok(verified > 0, 'No admin source assets found.');
console.log(`Verified ${verified} admin assets in ${outputRoot}.`);
