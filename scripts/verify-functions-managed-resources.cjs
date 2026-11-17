const fs = require('node:fs');
const path = require('node:path');

const SCHEDULED_FUNCTIONS = [
	'scheduledCheckInStats',
	'scheduledDateTimeSlotCounters',
	'scheduledFirestoreBackup',
	'scheduledRegistrationReview',
	'scheduledRegistrationStats',
	'scheduledUserStats',
];
const TASK_FUNCTION = 'ownerOperationWorker';
const TASK_FUNCTIONS = { [TASK_FUNCTION]: 3, waitingListEmailWorker: 5 };
const EVENT_FUNCTIONS = {
	sendNewRegistrationEmails: {
		type: 'google.cloud.firestore.document.v1.created',
		document: 'tmp_registrationemails/{docId}',
	},
	captureRegistrationReviewChange: {
		type: 'google.cloud.firestore.document.v1.written',
		document: 'registrations/{registrationId}',
	},
	sendRegistrationReviewEmail: {
		type: 'google.cloud.firestore.document.v1.created',
		document:
			'registrationReviewSeasons/{season}/cases/{caseId}/actions/{actionId}/email/{jobId}',
	},
};

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
			functionName === 'scheduledRegistrationReview'
				? '0 2 * * *'
				: schedules[functionName],
			`${jobName} schedule`,
		);
		assertEqual(job.timeZone, timeZone, `${jobName} time zone`);
		const targetUri = job.httpTarget?.uri;
		if (!targetUri) {
			throw new Error(`${jobName} is missing its HTTP target.`);
		}
		const target = new URL(targetUri);
		const functionAlias = `https://${region}-${project}.cloudfunctions.net/${functionName}`;
		const isRunTarget =
			target.hostname.startsWith(`${functionName.toLowerCase()}-`) &&
			target.hostname.endsWith('.a.run.app') &&
			target.pathname === '/';
		if (
			target.protocol !== 'https:' ||
			target.username ||
			target.password ||
			target.port ||
			target.search ||
			target.hash ||
			(!isRunTarget && target.href !== functionAlias)
		) {
			throw new Error(
				`${jobName} has an unexpected HTTP target: ${targetUri}`,
			);
		}
		assertEqual(
			job.httpTarget?.httpMethod,
			'POST',
			`${jobName} HTTP method`,
		);
		assertEqual(
			new URL(job.httpTarget?.oidcToken?.audience || '').href,
			target.href,
			`${jobName} OIDC audience`,
		);
	}

	let verifiedQueueCount = 0;
	for (const [expectedQueue, attempts] of Object.entries(TASK_FUNCTIONS)) {
		const managedQueues = taskQueues.filter(
			(queue) => resourceId(queue.name) === expectedQueue,
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
			attempts,
			`${expectedQueue} maximum attempts`,
		);

		verifiedQueueCount += managedQueues.length;
	}
	const managedTriggers = eventarcTriggers.filter(
		(trigger) => trigger.labels?.['goog-managed-by'] === 'cloudfunctions',
	);
	const eventFunctions = Object.entries(EVENT_FUNCTIONS);
	assertEqual(
		managedTriggers.length,
		eventFunctions.length,
		'Cloud Functions-managed Eventarc trigger count',
	);
	for (const [functionName, expected] of eventFunctions) {
		const destination = `projects/${project}/locations/${region}/functions/${functionName}`;
		const triggers = managedTriggers.filter(
			(trigger) => trigger.destination?.cloudFunction === destination,
		);
		assertEqual(triggers.length, 1, `${functionName} destination count`);
		const filters = Object.fromEntries(
			(triggers[0].eventFilters || []).map((filter) => [
				filter.attribute,
				filter.value,
			]),
		);
		assertEqual(filters.type, expected.type, `${functionName} event type`);
		assertEqual(
			filters.document,
			expected.document,
			`${functionName} document filter`,
		);
	}

	return {
		schedulerJobs: managedJobs.length,
		taskQueues: verifiedQueueCount,
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
	EVENT_FUNCTIONS,
	SCHEDULED_FUNCTIONS,
	TASK_FUNCTION,
	TASK_FUNCTIONS,
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
