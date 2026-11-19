const path = require('node:path');
const {
	assertFunctionsDeployFromCi,
} = require('./assert-functions-deploy-ci.cjs');

if (require.main === module) {
	try {
		assertFunctionsDeployFromCi(process.env);
		if (process.argv[2] !== 'deploy')
			throw new Error(
				'This CI wrapper only supports Firebase deployment.',
			);
		const packagePath = require.resolve('firebase-tools/package.json');
		const cliRoot = path.dirname(packagePath);
		// Preserve the normal Firebase CLI argument parsing and exit behavior.
		process.argv[1] = path.join(cliRoot, 'lib/bin/firebase.js');
		require(process.argv[1]);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
