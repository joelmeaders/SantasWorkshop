const fs = require('node:fs');
const path = require('node:path');

const SCHEDULED_FUNCTIONS = [
	'scheduledCheckInStats',
	'scheduledDateTimeSlotCounters',
	'scheduledFirestoreBackup',
	'scheduledRegistrationStats',
	'scheduledUserStats',
];
const TASK_FUNCTION = 'ownerOperationWorker';
const EVENT_FUNCTION = 'sendNewRegistrationEmails';

const resourceId = (name) =>
	String(name || '')
		.split('/')
		.pop();

const assertEqual = (actual, expected, message) => {
	if (actual !== expected) {
		throw new Error(`${message}: expected ${expected}, received ${actual}`);
	}
};

const verifyManagedResources = ({
	schedulerJobs,
	taskQueues,
	eventarcTriggers,
	project,
	region,
	timeZone,
	schedules,
}) => {
	const expectedJobs = SCHEDULED_FUNCTIONS.map(
		(functionName) => `firebase-schedule-${functionName}-${region}`,
	);
	const managedJobs = schedulerJobs.filter((job) =>
		resourceId(job.name).startsWith('firebase-schedule-'),
	);
	const actualJobs = managedJobs.map((job) => resourceId(job.name)).sort();
	assertEqual(
		JSON.stringify(actualJobs),
		JSON.stringify([...expectedJobs].sort()),
		'Firebase-managed Cloud Scheduler jobs do not match the expected set',
	);

	for (const functionName of SCHEDULED_FUNCTIONS) {
		const jobName = `firebase-schedule-${functionName}-${region}`;
		const job = managedJobs.find(
			(entry) => resourceId(entry.name) === jobName,
		);
		assertEqual(job.state, 'ENABLED', `${jobName} state`);
		assertEqual(
			job.schedule,
			schedules[functionName],
			`${jobName} schedule`,
		);
		assertEqual(job.timeZone, timeZone, `${jobName} time zone`);
		const targetUri = job.httpTarget?.uri;
		if (!targetUri) {
			throw new Error(`${jobName} is missing its HTTP target.`);
		}
		const target = new URL(targetUri);
		if (
			!target.hostname.startsWith(`${functionName.toLowerCase()}-`) ||
			!target.hostname.endsWith('.a.run.app')
		) {
			throw new Error(`${jobName} has an unexpected HTTP target: ${targetUri}`);
		}
		assertEqual(
			job.httpTarget?.httpMethod,
			'POST',
			`${jobName} HTTP method`,
		);
		assertEqual(
			new URL(job.httpTarget?.oidcToken?.audience || '').origin,
			target.origin,
			`${jobName} OIDC audience`,
		);
	}

	const expectedQueue = TASK_FUNCTION;
	const managedQueues = taskQueues.filter((queue) =>
		resourceId(queue.name) === expectedQueue,
	);
	assertEqual(
		JSON.stringify(
			managedQueues.map((queue) => resourceId(queue.name)).sort(),
		),
		JSON.stringify([expectedQueue]),
		'Firebase-managed Cloud Tasks queues do not match the expected set',
	);
	const queue = managedQueues[0];
	assertEqual(queue.state, 'RUNNING', `${expectedQueue} state`);
	assertEqual(
		Number(queue.rateLimits?.maxConcurrentDispatches),
		1,
		`${expectedQueue} maximum concurrent dispatches`,
	);
	assertEqual(
		Number(queue.rateLimits?.maxDispatchesPerSecond),
		1,
		`${expectedQueue} maximum dispatches per second`,
	);
	assertEqual(
		Number(queue.retryConfig?.maxAttempts),
		3,
		`${expectedQueue} maximum attempts`,
	);

	const managedTriggers = eventarcTriggers.filter(
		(trigger) => trigger.labels?.['goog-managed-by'] === 'cloudfunctions',
	);
	assertEqual(
		managedTriggers.length,
		1,
		'Cloud Functions-managed Eventarc trigger count',
	);
	const trigger = managedTriggers[0];
	assertEqual(
		trigger.destination?.cloudFunction,
		`projects/${project}/locations/${region}/functions/${EVENT_FUNCTION}`,
		`${EVENT_FUNCTION} destination`,
	);
	const filters = Object.fromEntries(
		(trigger.eventFilters || []).map((filter) => [
			filter.attribute,
			filter.value,
		]),
	);
	assertEqual(
		filters.type,
		'google.cloud.firestore.document.v1.created',
		`${EVENT_FUNCTION} event type`,
	);
	assertEqual(
		filters.document,
		'tmp_registrationemails/{docId}',
		`${EVENT_FUNCTION} document filter`,
	);

	return {
		schedulerJobs: managedJobs.length,
		taskQueues: managedQueues.length,
		eventarcTriggers: managedTriggers.length,
	};
};

const readJson = (filePath) =>
	JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));

const requiredEnvironment = (name) => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable ${name}.`);
	}
	return value;
};

const main = () => {
	const [schedulerPath, tasksPath, eventarcPath] = process.argv.slice(2);
	if (!schedulerPath || !tasksPath || !eventarcPath) {
		throw new Error(
			'Usage: node scripts/verify-functions-managed-resources.cjs <scheduler.json> <tasks.json> <eventarc.json>',
		);
	}

	const summary = verifyManagedResources({
		schedulerJobs: readJson(schedulerPath),
		taskQueues: readJson(tasksPath),
		eventarcTriggers: readJson(eventarcPath),
		project: requiredEnvironment('SANTASHOP_FIREBASE_PROJECT'),
		region: requiredEnvironment('SANTASHOP_FUNCTION_REGION'),
		timeZone: requiredEnvironment('SANTASHOP_TIME_ZONE'),
		schedules: {
			scheduledCheckInStats: requiredEnvironment(
				'SCHEDULED_CHECKIN_STATS',
			),
			scheduledDateTimeSlotCounters: requiredEnvironment(
				'SCHEDULED_DATETIME_SLOT_COUNTERS',
			),
			scheduledFirestoreBackup: requiredEnvironment(
				'SCHEDULED_FIRESTORE_BACKUP',
			),
			scheduledRegistrationStats: requiredEnvironment(
				'SCHEDULED_REGISTRATION_STATS',
			),
			scheduledUserStats: requiredEnvironment('SCHEDULED_USER_STATS'),
		},
	});

	console.log(
		`Verified ${summary.schedulerJobs} Scheduler jobs, ${summary.taskQueues} task queue, and ${summary.eventarcTriggers} Eventarc trigger.`,
	);
};

module.exports = {
	EVENT_FUNCTION,
	SCHEDULED_FUNCTIONS,
	TASK_FUNCTION,
	verifyManagedResources,
};

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
