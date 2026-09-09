export const PROJECT = 'santas-workshop-test';
export const REGION = 'us-central1';
export const NETWORK = 'load-email-isolation';
export const CONNECTOR_ID = 'load-email';
export const CONNECTOR = `projects/${PROJECT}/locations/${REGION}/connectors/${CONNECTOR_ID}`;
export const GOOGLE_API_RANGE = '199.36.153.8/30';
export const GOOGLE_API_IPS = [
	'199.36.153.8',
	'199.36.153.9',
	'199.36.153.10',
	'199.36.153.11',
];
export const TARGETS = Object.freeze({
	smoke: 5,
	calibration: { count: 24, durationMs: 120_000 },
	signup: { count: 1080, durationMs: 900_000 },
	signupBurst: { count: 135, durationMs: 60_000, repetitions: 3 },
	signupCluster: { count: 9, durationMs: 1000 },
	staff: { count: 243, durationMs: 900_000, sessions: 10 },
	checkinBurst: { count: 23, durationMs: 60_000 },
	checkinCluster: { count: 5, durationMs: 1000 },
	duplicateScans: 10,
	drainMs: 120_000,
	emailDrainMs: 300_000,
	budgetUsd: 25,
	arrivalStopUsd: 20,
});

export function assertProject(project) {
	if (project !== PROJECT)
		throw new Error(`Only ${PROJECT} is permitted. No action was taken.`);
	for (const key of [
		'FIRESTORE_EMULATOR_HOST',
		'FIREBASE_AUTH_EMULATOR_HOST',
		'FIREBASE_STORAGE_EMULATOR_HOST',
		'FUNCTIONS_EMULATOR',
	]) {
		if (process.env[key])
			throw new Error(
				`Remove ${key}; this harness targets deployed test only.`,
			);
	}
}

export function assertRunId(runId) {
	if (!/^load-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$/.test(runId ?? '')) {
		throw new Error('Run ID must be load-YYYYMMDDTHHMMSSZ-xxxxxxxx.');
	}
}

export function assertClientConfig(config) {
	assertProject(config.projectId);
	if (!config.apiKey || !config.appId || !config.appId.startsWith('1:'))
		throw new Error('Verified Firebase app configuration is required.');
	if (
		config.storageBucket !== `${PROJECT}.appspot.com` &&
		config.storageBucket !== `${PROJECT}.firebasestorage.app`
	)
		throw new Error('Unexpected Storage bucket.');
	if (
		![
			'https://test.denversantaclausshop.org',
			'https://santashop-app-test.web.app',
		].includes(config.customerOrigin)
	)
		throw new Error('Unexpected customer origin.');
	if (config.adminOrigin !== 'https://santas-workshop-test.web.app')
		throw new Error('Unexpected admin origin.');
}

export function childFixture(programYear, id) {
	return {
		id,
		firstName: `Child${id}`,
		lastName: 'LoadFixture',
		dateOfBirth: `${programYear - [1, 4, 7][id]}-01-15`,
		toyType: ['infants', 'girls', 'boys'][id],
	};
}

export function isCustomerCallable(config, url, method) {
	const target = new URL(url);
	return (
		method === 'POST' &&
		[
			target.origin === config.customerOrigin,
			target.origin === `https://${REGION}-${PROJECT}.cloudfunctions.net`,
		].some(Boolean) &&
		/^\/[A-Za-z][A-Za-z0-9]*$/.test(target.pathname)
	);
}
