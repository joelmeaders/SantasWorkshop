import { randomUUID } from 'node:crypto';
import { PROJECT, assertClientConfig } from './config.mjs';

export async function discoverConfiguration(client, snapshot) {
	const apps = await client.list(
		`https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/webApps`,
		'apps',
	);
	const app = apps.find(
		(item) =>
			/app|customer/i.test(item.displayName) &&
			!/admin/i.test(item.displayName),
	);
	if (!app)
		throw new Error(
			'The customer Firebase Web App was not uniquely identified.',
		);
	const config = await client.request(
		`https://firebase.googleapis.com/v1beta1/${app.name}/config`,
	);
	Object.assign(config, {
		customerOrigin: 'https://test.denversantaclausshop.org',
		adminOrigin: 'https://santas-workshop-test.web.app',
	});
	assertClientConfig(config);
	const template = await client.request(
		`https://firebaseremoteconfig.googleapis.com/v1/projects/${PROJECT}/remoteConfig`,
	);
	const candidates = [
		template.parameters,
		...Object.values(template.parameterGroups ?? {}).map(
			(group) => group.parameters,
		),
	]
		.map((parameters) => parameters?.santashop_public_parameters)
		.filter(Boolean);
	if (
		candidates.length !== 1 ||
		Object.keys(candidates[0].conditionalValues ?? {}).length
	)
		throw new Error('Public settings are missing or conditional.');
	const settings = JSON.parse(candidates[0].defaultValue.value);
	if (
		settings.maintenanceModeEnabled ||
		!settings.createAccountEnabled ||
		!settings.registrationEnabled ||
		!settings.admin?.checkinEnabled ||
		!settings.admin?.onsiteRegistrationEnabled
	)
		throw new Error(
			'Test public settings do not permit the required customer and staff journeys.',
		);
	const years = new Set(
		snapshot.functions
			.map(
				(fn) =>
					fn.serviceConfig.environmentVariables
						?.SANTASHOP_PROGRAM_YEAR,
			)
			.filter(Boolean),
	);
	if (years.size !== 1 || !/^20\d{2}$/.test([...years][0]))
		throw new Error('Deployed program years are inconsistent.');
	const year = Number([...years][0]);
	const counter = snapshot.scheduler.find((job) =>
		job.name.endsWith('scheduledDateTimeSlotCounters-us-central1'),
	);
	if (
		!counter ||
		counter.state !== 'ENABLED' ||
		counter.schedule !== '*/5 * * * *'
	)
		throw new Error(
			'Test counter scheduler must be enabled every five minutes throughout the load run.',
		);
	return {
		config,
		year,
		counterIntervalMs: 300_000,
		remoteConfigVersion: template.version?.versionNumber,
	};
}

/** This debug provider still exchanges and sends genuine App Check tokens. Browser smoke uses its normal provider. */
export async function createAppCheckSession(client, config, runId, journal) {
	const root = `https://firebaseappcheck.googleapis.com/v1/projects/${PROJECT}/apps/${encodeURIComponent(config.appId)}`;
	const debugSecret = randomUUID();
	const debug = await client.request(`${root}/debugTokens`, {
		method: 'POST',
		body: { displayName: runId, token: debugSecret },
	});
	journal.record({ type: 'app-check-debug-registration', name: debug.name });
	let token;
	let expires = 0;
	return {
		async refresh() {
			const response = await fetch(
				`${root}:exchangeDebugToken?key=${encodeURIComponent(config.apiKey)}`,
				{
					method: 'POST',
					redirect: 'error',
					signal: AbortSignal.timeout(30_000),
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ debugToken: debugSecret }),
				},
			);
			const result = await response.json();
			if (!response.ok || !result.token)
				throw new Error('App Check debug exchange failed.');
			token = result.token;
			expires =
				Date.now() +
				Number(result.ttl.replace('s', '')) * 1000 -
				60_000;
		},
		token() {
			if (!token || Date.now() >= expires)
				throw new Error('App Check token is missing or expired.');
			return token;
		},
	};
}
