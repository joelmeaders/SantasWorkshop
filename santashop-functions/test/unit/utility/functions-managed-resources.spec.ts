import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface ManagedResourceInput {
	schedulerJobs: unknown[];
	taskQueues: unknown[];
	eventarcTriggers: unknown[];
	project: string;
	region: string;
	timeZone: string;
	schedules: Record<string, string>;
}

const requireFromTest = createRequire(import.meta.url);
const resources = requireFromTest(
	'../../../../scripts/verify-functions-managed-resources.cjs',
) as {
	SCHEDULED_FUNCTIONS: string[];
	verifyManagedResources: (input: ManagedResourceInput) => {
		schedulerJobs: number;
		taskQueues: number;
		eventarcTriggers: number;
	};
};

const project = 'santas-workshop-test';
const region = 'us-central1';
const schedules = Object.fromEntries(
	resources.SCHEDULED_FUNCTIONS.map((functionName) => [
		functionName,
		`schedule-for-${functionName}`,
	]),
);

const validInput = (): ManagedResourceInput => ({
	schedulerJobs: resources.SCHEDULED_FUNCTIONS.map((functionName) => {
		const jobName = `firebase-schedule-${functionName}-${region}`;
		return {
			name: `projects/${project}/locations/${region}/jobs/${jobName}`,
			state: 'ENABLED',
			schedule: schedules[functionName],
			timeZone: 'America/Denver',
			httpTarget: {
				httpMethod: 'POST',
				uri: `https://${functionName.toLowerCase()}-abc123-uc.a.run.app/`,
				oidcToken: {
					audience: `https://${functionName.toLowerCase()}-abc123-uc.a.run.app`,
				},
			},
		};
	}),
	taskQueues: [
		{
			name: `projects/${project}/locations/${region}/queues/ownerOperationWorker`,
			state: 'RUNNING',
			rateLimits: {
				maxConcurrentDispatches: 1,
				maxDispatchesPerSecond: 1,
			},
			retryConfig: { maxAttempts: 3 },
		},
	],
	eventarcTriggers: [
		{
			name: `projects/${project}/locations/nam5/triggers/sendnewregistrationemails-123456`,
			labels: { 'goog-managed-by': 'cloudfunctions' },
			destination: {
				cloudFunction: `projects/${project}/locations/${region}/functions/sendNewRegistrationEmails`,
			},
			eventFilters: [
				{
					attribute: 'type',
					value: 'google.cloud.firestore.document.v1.created',
				},
				{
					attribute: 'document',
					value: 'tmp_registrationemails/{docId}',
				},
			],
		},
	],
	project,
	region,
	timeZone: 'America/Denver',
	schedules,
});

describe('Functions managed deployment resources', () => {
	const setTarget = (
		input: ManagedResourceInput,
		uri: string,
		audience = uri,
	): void => {
		input.schedulerJobs[0] = {
			...(input.schedulerJobs[0] as object),
			httpTarget: { httpMethod: 'POST', uri, oidcToken: { audience } },
		};
	};
	const functionName = resources.SCHEDULED_FUNCTIONS[0];
	const alias = `https://${region}-${project}.cloudfunctions.net/${functionName}`;

	it('accepts a Gen 2 cloudfunctions.net alias with its complete OIDC audience', () => {
		const input = validInput();
		setTarget(input, alias);
		expect(resources.verifyManagedResources(input).schedulerJobs).toBe(5);
	});

	it.each([
		alias.replace(project, 'another-project'),
		alias.replace(region, 'us-east1'),
		alias.replace(functionName, 'scheduledUserStats'),
		`${alias}/extra`,
		`${alias}?extra=1`,
		alias.replace('https:', 'http:'),
		`https://${functionName.toLowerCase()}-abc123-uc.a.run.app/extra`,
		`https://${functionName.toLowerCase()}-abc123-uc.a.run.app.evil.example/`,
	])('rejects an unexpected scheduler endpoint: %s', (uri) => {
		const input = validInput();
		setTarget(input, uri);
		expect(() => resources.verifyManagedResources(input)).toThrow(
			'unexpected HTTP target',
		);
	});

	it.each([
		new URL(alias).origin,
		alias.replace(functionName, 'scheduledUserStats'),
		`${alias}/`,
	])(
		'rejects an OIDC audience that omits or changes the function path: %s',
		(audience) => {
			const input = validInput();
			setTarget(input, alias, audience);
			expect(() => resources.verifyManagedResources(input)).toThrow(
				'OIDC audience',
			);
		},
	);

	it('accepts the complete scheduler, task queue, and Eventarc topology', () => {
		expect(resources.verifyManagedResources(validInput())).toEqual({
			schedulerJobs: 5,
			taskQueues: 1,
			eventarcTriggers: 1,
		});
	});

	it('rejects a missing Firebase-managed task queue', () => {
		const input = validInput();
		input.taskQueues = [];

		expect(() => resources.verifyManagedResources(input)).toThrow(
			'Firebase-managed Cloud Tasks queues do not match the expected set',
		);
	});

	it('rejects a disabled scheduled job', () => {
		const input = validInput();
		input.schedulerJobs[0] = {
			...(input.schedulerJobs[0] as object),
			state: 'PAUSED',
		};

		expect(() => resources.verifyManagedResources(input)).toThrow('state');
	});
});
