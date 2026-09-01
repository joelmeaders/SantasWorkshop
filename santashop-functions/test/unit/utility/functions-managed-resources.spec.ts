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
			pubsubTarget: {
				topicName: `projects/${project}/topics/${jobName}`,
			},
		};
	}),
	taskQueues: [
		{
			name: `projects/${project}/locations/${region}/queues/firebase-functions-ownerOperationWorker-${region}`,
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
