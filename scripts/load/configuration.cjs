// Normal test deployments use SES. Isolation requires an explicit test-only opt-in.
const loadTestMode = (mode, env = process.env) => {
	const value = env.SANTASHOP_LOAD_TEST_MODE;
	if (value !== undefined && value !== 'true' && value !== 'false') {
		throw new Error('SANTASHOP_LOAD_TEST_MODE must be true or false.');
	}
	if (value === 'true' && mode !== 'test') {
		throw new Error(
			'Load-test isolation is restricted to the test project.',
		);
	}
	return value === 'true';
};

const applyLoadTestConfiguration = (config) => {
	delete config.AWS_ACCESS_KEY_ID;
	delete config.AWS_SECRET_ACCESS_KEY;
	config.SANTASHOP_EMAIL_TRANSPORT = 'sink';
	config.SANTASHOP_EMAIL_VPC_CONNECTOR =
		'projects/santas-workshop-test/locations/us-central1/connectors/load-email';
	config.SCHEDULED_DATETIME_SLOT_COUNTERS = '*/5 * * * *';
};

module.exports = { loadTestMode, applyLoadTestConfiguration };
