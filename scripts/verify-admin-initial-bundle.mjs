import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const [metafilePath] = process.argv.slice(2);
const MAX_STATIC_BYTES = 1_350_000;

if (!metafilePath) {
	throw new Error(
		'Usage: node scripts/verify-admin-initial-bundle.mjs <stats.json>',
	);
}

const resolvedMetafilePath = resolve(metafilePath);
const metafile = JSON.parse(await readFile(resolvedMetafilePath, 'utf8'));
const outputEntries = Object.entries(metafile.outputs);
const entry = outputEntries.find(
	([, output]) => output.entryPoint === 'santashop-admin/src/main.ts',
);

if (!entry) {
	throw new Error(
		'The admin main entry point was not found in the metafile.',
	);
}

const staticOutputs = collectStaticOutputs(entry[0], metafile.outputs);
const staticBytes = [...staticOutputs].reduce(
	(total, outputPath) => total + metafile.outputs[outputPath].bytes,
	0,
);
const staticInputs = collectInputs(staticOutputs, metafile.outputs);
const allInputs = collectInputs(
	new Set(outputEntries.map(([outputPath]) => outputPath)),
	metafile.outputs,
);

const forbiddenInitialInputs = [...staticInputs].filter(
	(inputPath) =>
		isFirestoreInput(inputPath) ||
		isStorageInput(inputPath) ||
		inputPath.includes('@firebase+webchannel-wrapper') ||
		inputPath.includes('/re2js/'),
);

if (forbiddenInitialInputs.length > 0) {
	throw new Error(
		`The admin initial graph contains deferred Firebase code:\n${forbiddenInitialInputs.join('\n')}`,
	);
}

if (staticBytes > MAX_STATIC_BYTES) {
	throw new Error(
		`The admin initial static graph is ${staticBytes.toLocaleString()} bytes; the limit is ${MAX_STATIC_BYTES.toLocaleString()} bytes.`,
	);
}

if (![...allInputs].some(isFirestoreInput)) {
	throw new Error(
		'The production bundle does not contain the realtime Firestore client required by authenticated staff routes.',
	);
}

const storageInputs = [...allInputs].filter(isStorageInput);
if (storageInputs.length > 0) {
	throw new Error(
		`The admin bundle contains unused Firebase Storage code:\n${storageInputs.join('\n')}`,
	);
}

await unlink(resolvedMetafilePath);

console.log(
	`Admin initial static graph: ${staticBytes.toLocaleString()} bytes across ${staticOutputs.size} JavaScript outputs.`,
);
console.log(
	'Full Firestore is deferred to authenticated routes; Firebase Storage is absent.',
);

function collectStaticOutputs(entryPath, outputs) {
	const visited = new Set();
	const pending = [entryPath];

	while (pending.length > 0) {
		const outputPath = pending.pop();
		if (!outputPath || visited.has(outputPath)) {
			continue;
		}

		const output = outputs[outputPath];
		if (!output) {
			throw new Error(
				`Missing imported output in metafile: ${outputPath}`,
			);
		}

		visited.add(outputPath);
		for (const imported of output.imports ?? []) {
			if (imported.kind !== 'dynamic-import') {
				pending.push(imported.path);
			}
		}
	}

	return visited;
}

function collectInputs(outputPaths, outputs) {
	return new Set(
		[...outputPaths].flatMap((outputPath) =>
			Object.keys(outputs[outputPath]?.inputs ?? {}),
		),
	);
}

function isFirestoreInput(inputPath) {
	return (
		inputPath.includes('@firebase+firestore') ||
		inputPath.includes('@firebase/firestore') ||
		inputPath.includes('firebase/firestore')
	);
}

function isStorageInput(inputPath) {
	return (
		inputPath.includes('@firebase+storage') ||
		inputPath.includes('@firebase/storage') ||
		inputPath.includes('firebase/storage')
	);
}
