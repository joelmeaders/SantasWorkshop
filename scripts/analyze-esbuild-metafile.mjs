import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeMetafile } from 'esbuild';

const [metafilePath] = process.argv.slice(2);

if (!metafilePath) {
	console.error('Usage: node scripts/analyze-esbuild-metafile.mjs <stats.json>');
	process.exitCode = 1;
} else {
	const resolvedPath = resolve(metafilePath);
	const metafile = JSON.parse(await readFile(resolvedPath, 'utf8'));
	console.log(await analyzeMetafile(metafile, { verbose: true }));
}
