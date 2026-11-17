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
const scheduleNames = [
	'scheduledCheckInStats',
	'scheduledDateTimeSlotCounters',
	'scheduledFirestoreBackup',
	'scheduledRegistrationReview',
	'scheduledRegistrationStats',
	'scheduledUserStats',
];
const schedules = Object.fromEntries(
	scheduleNames.map((functionName) => [
		functionName,
		functionName === 'scheduledRegistrationReview'
			? '0 2 * * *'
			: `schedule-for-${functionName}`,
	]),
);

function eventTrigger(
	functionName: string,
	operation: 'created' | 'written',
	document: string,
): object {
	return {
		name: `projects/${project}/locations/nam5/triggers/${functionName.toLowerCase()}-123456`,
		labels: { 'goog-managed-by': 'cloudfunctions' },
		destination: {
			cloudFunction: `projects/${project}/locations/${region}/functions/${functionName}`,
		},
		eventFilters: [
			{
				attribute: 'type',
				value: 'google.cloud.firestore.document.v1.' + operation,
			},
			{ attribute: 'document', value: document },
		],
	};
}

const validInput = (): ManagedResourceInput => ({
	schedulerJobs: scheduleNames.map((functionName) => {
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
			name: `projects/${project}/locations/${region}/queues/waitingListEmailWorker`,
			state: 'RUNNING',
			rateLimits: {
				maxConcurrentDispatches: 1,
				maxDispatchesPerSecond: 1,
			},
			retryConfig: { maxAttempts: 5 },
		},
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
		eventTrigger(
			'sendNewRegistrationEmails',
			'created',
			'tmp_registrationemails/{docId}',
		),
		eventTrigger(
			'captureRegistrationReviewChange',
			'written',
			'registrations/{registrationId}',
		),
		eventTrigger(
			'sendRegistrationReviewEmail',
			'created',
			'registrationReviewSeasons/{season}/cases/{caseId}/actions/{actionId}/email/{jobId}',
		),
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
	const functionName = scheduleNames[0];
	const alias = `https://${region}-${project}.cloudfunctions.net/${functionName}`;

	it('accepts a Gen 2 cloudfunctions.net alias with its complete OIDC audience', () => {
		const input = validInput();
		setTarget(input, alias);
		expect(resources.verifyManagedResources(input).schedulerJobs).toBe(6);
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
			schedulerJobs: 6,
			taskQueues: 2,
			eventarcTriggers: 3,
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
	it('rejects missing or additional Firebase-managed scheduled jobs', () => {
		const missing = validInput();
		missing.schedulerJobs.splice(3, 1);
		const extra = validInput();
		extra.schedulerJobs.push({
			name: `projects/${project}/locations/${region}/jobs/firebase-schedule-extra-${region}`,
		});
		for (const input of [missing, extra]) {
			expect(() => resources.verifyManagedResources(input)).toThrow(
				'Firebase-managed Cloud Scheduler jobs do not match the expected set',
			);
		}
	});

	it('rejects a registration review schedule set at a different time', () => {
		const input = validInput();
		input.schedulerJobs[3] = {
			...(input.schedulerJobs[3] as object),
			schedule: '0 3 * * *',
		};
		expect(() => resources.verifyManagedResources(input)).toThrow(
			'scheduledRegistrationReview-us-central1 schedule',
		);
	});

	it('rejects a missing, additional, or duplicate Cloud Functions Eventarc destination', () => {
		const missing = validInput();
		missing.eventarcTriggers.pop();
		const extra = validInput();
		extra.eventarcTriggers.push(
			eventTrigger('anotherEvent', 'created', 'other/{id}'),
		);
		for (const input of [missing, extra]) {
			expect(() => resources.verifyManagedResources(input)).toThrow(
				'Cloud Functions-managed Eventarc trigger count',
			);
		}
		const duplicate = validInput();
		duplicate.eventarcTriggers[2] = duplicate.eventarcTriggers[1];
		expect(() => resources.verifyManagedResources(duplicate)).toThrow(
			'captureRegistrationReviewChange destination count',
		);
	});

	it('rejects review triggers with drift in event type, document filter, or destination', () => {
		const type = validInput();
		type.eventarcTriggers[1] = eventTrigger(
			'captureRegistrationReviewChange',
			'created',
			'registrations/{registrationId}',
		);
		expect(() => resources.verifyManagedResources(type)).toThrow(
			'captureRegistrationReviewChange event type',
		);

		const document = validInput();
		document.eventarcTriggers[2] = eventTrigger(
			'sendRegistrationReviewEmail',
			'created',
			'registrationReviewSeasons/{season}/cases/{caseId}',
		);
		expect(() => resources.verifyManagedResources(document)).toThrow(
			'sendRegistrationReviewEmail document filter',
		);

		const destination = validInput();
		destination.eventarcTriggers[1] = {
			...(destination.eventarcTriggers[1] as object),
			destination: {
				cloudFunction: `projects/${project}/locations/us-east1/functions/captureRegistrationReviewChange`,
			},
		};
		expect(() => resources.verifyManagedResources(destination)).toThrow(
			'captureRegistrationReviewChange destination',
		);
	});
});
