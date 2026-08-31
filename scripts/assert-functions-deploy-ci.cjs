const ALLOWED_DEPLOY_TARGETS = new Set(['test', 'prod']);

const assertFunctionsDeployFromCi = (env = process.env) => {
	if (env.GITHUB_ACTIONS !== 'true') {
		throw new Error(
			'Firebase Functions deployments are GitHub Actions-only. Run the Functions release workflow instead of deploying locally.',
		);
	}

	const deployTarget = env.SANTASHOP_FUNCTIONS_DEPLOY;
	if (!ALLOWED_DEPLOY_TARGETS.has(deployTarget)) {
		throw new Error(
			'SANTASHOP_FUNCTIONS_DEPLOY must explicitly identify the GitHub Actions deploy target as "test" or "prod".',
		);
	}

	return deployTarget;
};

const main = () => {
	const deployTarget = assertFunctionsDeployFromCi();
	console.log(
		`Authorized GitHub Actions Firebase Functions deployment for ${deployTarget}.`,
	);
};

module.exports = {
	ALLOWED_DEPLOY_TARGETS,
	assertFunctionsDeployFromCi,
	main,
};

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
