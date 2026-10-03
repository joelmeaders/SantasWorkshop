const path = require('node:path');
const {
	assertFunctionsDeployFromCi,
} = require('./assert-functions-deploy-ci.cjs');

// firebase-tools 15.29.0 cloudtasks.setEnqueuer calls .filter() on
// policy.bindings, although an empty Cloud Tasks policy omits that field.
// Normalize only that GET response; keep the CLI's IAM writes unchanged.
const normalizeQueuePolicy = (policy) => {
	if (!policy || typeof policy !== 'object' || Array.isArray(policy))
		throw new Error('Invalid Cloud Tasks IAM policy response.');
	if (policy.bindings !== undefined && !Array.isArray(policy.bindings))
		throw new Error('Invalid Cloud Tasks IAM policy bindings.');
	return policy.bindings === undefined ? { ...policy, bindings: [] } : policy;
};

const installQueuePolicyCompatibility = (cloudTasks, version) => {
	if (version !== '15.29.0')
		throw new Error(
			'Review the Cloud Tasks IAM compatibility fix for this Firebase CLI version.',
		);
	if (typeof cloudTasks?.getIamPolicy !== 'function')
		throw new Error('Firebase CLI Cloud Tasks IAM reader is unavailable.');
	const original = cloudTasks.getIamPolicy;
	cloudTasks.getIamPolicy = async (...args) =>
		normalizeQueuePolicy(await original.apply(cloudTasks, args));
	return () => {
		cloudTasks.getIamPolicy = original;
	};
};

module.exports = { normalizeQueuePolicy, installQueuePolicyCompatibility };

if (require.main === module) {
	try {
		assertFunctionsDeployFromCi(process.env);
		if (process.argv[2] !== 'deploy')
			throw new Error(
				'This CI wrapper only supports Firebase deployment.',
			);
		const packagePath = require.resolve('firebase-tools/package.json');
		const cliRoot = path.dirname(packagePath);
		const { version } = require(packagePath);
		const cloudTasks = require(path.join(cliRoot, 'lib/gcp/cloudtasks.js'));
		installQueuePolicyCompatibility(cloudTasks, version);
		// Preserve the normal Firebase CLI argument parsing and exit behavior.
		process.argv[1] = path.join(cliRoot, 'lib/bin/firebase.js');
		require(process.argv[1]);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
