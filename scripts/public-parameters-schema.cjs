const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

// Run the same validator as the apps and Functions without a second schema.
// This compilation exists only in release/test tooling.
const filename = path.resolve(
	__dirname,
	'../santashop-models/src/lib/public-parameters-config.ts',
);
const compiled = buildSync({
	entryPoints: [filename],
	bundle: true,
	platform: 'node',
	format: 'cjs',
	write: false,
}).outputFiles[0].text;
const schemaModule = new Module(filename, module);
schemaModule.filename = filename;
schemaModule.paths = module.paths;
schemaModule._compile(compiled, filename);
module.exports = schemaModule.exports;
