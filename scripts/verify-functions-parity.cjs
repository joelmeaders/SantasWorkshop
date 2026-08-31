const fs = require('node:fs');
const path = require('node:path');

const TEST_HELPERS_MARKER = '// ------------------------------------- TEST HELPER FUNCTIONS';

const sourceFunctionIds = (source) => {
	const productionSource = source.split(TEST_HELPERS_MARKER, 1)[0];
	return [...productionSource.matchAll(/^export const ([A-Za-z0-9_]+)\s*=/gm)]
		.map((match) => match[1])
		.sort();
};

const deployedFunctionIds = (firebaseOutput) => {
	const parsed = typeof firebaseOutput === 'string'
		? JSON.parse(firebaseOutput)
		: firebaseOutput;
	const functions = Array.isArray(parsed) ? parsed : parsed.result;
	if (!Array.isArray(functions)) {
		throw new Error('Firebase Functions list output did not contain a result array.');
	}

	return functions.map((entry) => entry.id).filter(Boolean).sort();
};

const compareFunctionIds = (expected, actual) => ({
	missing: expected.filter((id) => !actual.includes(id)),
	unexpected: actual.filter((id) => !expected.includes(id)),
});

const verifyFunctionsParity = (source, firebaseOutput) => {
	const expected = sourceFunctionIds(source);
	const actual = deployedFunctionIds(firebaseOutput);
	const differences = compareFunctionIds(expected, actual);
	if (differences.missing.length || differences.unexpected.length) {
		throw new Error([
			'Live Firebase Functions do not match the production source exports.',
			`Missing: ${differences.missing.join(', ') || 'none'}`,
			`Unexpected: ${differences.unexpected.join(', ') || 'none'}`,
		].join('\n'));
	}

	return expected;
};

const main = () => {
	const outputPath = process.argv[2];
	if (!outputPath) {
		throw new Error('Usage: node scripts/verify-functions-parity.cjs <firebase-functions-list.json>');
	}

	const root = path.resolve(__dirname, '..');
	const source = fs.readFileSync(
		path.join(root, 'santashop-functions', 'src', 'index.ts'),
		'utf8',
	);
	const output = fs.readFileSync(path.resolve(outputPath), 'utf8');
	const ids = verifyFunctionsParity(source, output);
	console.log(`Verified ${ids.length} production Functions; live inventory matches source.`);
};

module.exports = {
	compareFunctionIds,
	deployedFunctionIds,
	sourceFunctionIds,
	verifyFunctionsParity,
};

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
