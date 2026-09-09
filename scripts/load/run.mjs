import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	PROJECT,
	TARGETS,
	assertProject,
	assertRunId,
	childFixture,
} from './config.mjs';
import { GoogleClient, firestoreBase, encodeFields, query } from './google.mjs';
import { requireIsolation } from './isolation.mjs';
import { discoverConfiguration, createAppCheckSession } from './preflight.mjs';
import { CustomerApi } from './customer.mjs';
import { RunJournal, arrivals, delay } from './metrics.mjs';
import { costCeiling, enforceBudget, instanceEvidence } from './monitor.mjs';
import { document, verifyRun } from './verify.mjs';
import {
	collectResourceEvidence,
	METRIC_SETTLE_MS,
	resourceObservationEnd,
} from './resources.mjs';

const option = (name) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
};
const command = process.argv[2];
const skipSmoke = process.argv.includes('--skip-smoke');
if (skipSmoke && command !== 'run')
	throw new Error('--skip-smoke is supported only by the full run command.');
assertProject(option('--project'));
const client = new GoogleClient(PROJECT);
const runId =
	option('--run-id') ??
	`load-${new Date()
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '')}-${randomBytes(4).toString('hex')}`;
assertRunId(runId);
const directory = resolve('artifacts/load', runId);
mkdirSync(directory, { recursive: true });
const journalPath = resolve(directory, 'events.jsonl');
const journal = new RunJournal(journalPath);
let monitorTimer;
let monitorWork;
let appCheck;
let fixtureIndex = 0;
let slotId = `${runId}-slot`;
let started = Date.now();
let configuration;
let proof;

function fixture() {
	const id = `fixture-${String(++fixtureIndex).padStart(5, '0')}`;
	return {
		id,
		firstName: 'LoadQA',
		lastName: 'Fixture',
		zipCode: '80202',
		emailAddress: `${runId}-${id}@example.invalid`,
		password: `Load1!${randomBytes(16).toString('hex')}`,
	};
}

async function checkIsolation() {
	const next = await requireIsolation(client, await client.identityToken());
	if (proof && next.fingerprint !== proof.fingerprint)
		throw new Error('Deployed revisions changed during the run.');
	journal.record({ type: 'isolation', ...next.report });
	journal.isolationExpiresAt = Date.now() + 120_000;
	return next;
}

async function monitor() {
	try {
		await checkIsolation();
		await appCheck?.refresh();
		const cost = costCeiling(proof.snapshot, (Date.now() - started) / 1000);
		journal.record({ type: 'cost-estimate', ...cost });
		enforceBudget(cost);
		try {
			journal.record({
				type: 'instances',
				...(await instanceEvidence(client, proof.snapshot)),
			});
		} catch (error) {
			if (
				Date.now() - started < 300_000 &&
				error.message ===
					'Cloud Run instance monitoring returned no evidence.'
			)
				journal.record({
					type: 'monitoring-warmup',
					reason: 'Waiting for the first application samples; five-minute limit.',
				});
			else throw error;
		}
	} catch (error) {
		journal.stop(error.message);
	}
}

async function verifyResources(verification) {
	const endTime = resourceObservationEnd(verification.checkedAt);
	journal.record({
		type: 'resource-metrics-wait',
		endTime,
		settleMs: METRIC_SETTLE_MS,
	});
	while (Date.now() < Date.parse(endTime) + METRIC_SETTLE_MS) {
		journal.assertRunning();
		await delay(15_000);
	}
	const names = new Set(
		proof.snapshot.functions.map((fn) => fn.name.split('/').at(-1)),
	);
	const required = new Set(
		journal.events
			.filter(
				(event) =>
					event.type === 'request' &&
					event.ok &&
					names.has(event.operation),
			)
			.map((event) => event.operation),
	);
	if (verification.completedRegistrations) {
		required.add('sendNewRegistrationEmails');
		required.add('publicParametersGateway');
	}
	if (verification.expectedSlots)
		required.add('scheduledDateTimeSlotCounters');
	const report = await collectResourceEvidence(
		client,
		proof.snapshot.functions,
		{
			startTime: new Date(started).toISOString(),
			endTime,
			requiredFunctions: [...required].sort(),
		},
	);
	writeFileSync(
		resolve(directory, 'resources.json'),
		JSON.stringify(report, null, 2),
	);
	journal.record({
		type: 'resource-verification',
		passed: report.passed,
		requiredFunctions: report.requiredFunctions,
		problems: report.problems,
	});
	if (!report.passed || !report.metricsSettled)
		throw new Error(
			'Function resource verification failed. See resources.json.',
		);
}

try {
	if (command === 'verify') {
		if (!option('--run-id'))
			throw new Error('Verification requires an existing --run-id.');
		journal.events = readFileSync(journalPath, 'utf8')
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line));
		const header = journal.events.find((event) => event.type === 'run');
		if (!header || header.project !== PROJECT || header.runId !== runId)
			throw new Error('Run manifest identity mismatch.');
		slotId = header.slotId;
		const result = await verifyRun(client, journal, slotId, { waitMs: 0 });
		writeFileSync(
			resolve(directory, 'verification.json'),
			JSON.stringify(result, null, 2),
		);
		if (!result.passed) process.exitCode = 1;
	} else {
		if (!['preflight', 'smoke', 'run'].includes(command))
			throw new Error(
				'Use preflight, smoke, run, or verify with --project santas-workshop-test.',
			);
		proof = await checkIsolation();
		configuration = await discoverConfiguration(client, proof.snapshot);
		journal.record({
			type: 'preflight',
			year: configuration.year,
			remoteConfigVersion: configuration.remoteConfigVersion,
		});
		if (command === 'run' || command === 'smoke') {
			if (option('--run-id'))
				throw new Error(
					'New runs generate a fresh ID; use verify for existing runs.',
				);
			const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
				encoding: 'utf8',
			}).trim();
			if (
				execFileSync('git', ['status', '--porcelain'], {
					encoding: 'utf8',
				}).trim()
			)
				throw new Error(
					'Commit the reviewed harness before a hosted run.',
				);
			journal.record({
				type: 'run',
				commitSha,
				project: PROJECT,
				runId,
				slotId,
				targets: TARGETS,
				startedAt: new Date(started).toISOString(),
				mode: command,
				smokeSkipped: skipSmoke,
				browserAppCheckProvider: 'registered-test-debug',
				revisionFingerprint: proof.fingerprint,
			});
			appCheck = await createAppCheckSession(
				client,
				configuration.config,
				runId,
				journal,
			);
			await appCheck.refresh();
			const api = new CustomerApi(
				configuration.config,
				() => appCheck.token(),
				journal,
			);
			const noAttestation = new CustomerApi(
				configuration.config,
				() => '',
				journal,
			);
			let rejectedMissingAppCheck = false;
			try {
				await noAttestation.call(
					'app-check-negative',
					'newAccount',
					{},
					undefined,
					{ expectedCodes: ['UNAUTHENTICATED'] },
				);
			} catch (error) {
				if (error.code !== 'UNAUTHENTICATED') throw error;
				rejectedMissingAppCheck = true;
			}
			if (!rejectedMissingAppCheck)
				throw new Error('Missing App Check was not rejected.');
			await client.request(
				`${firestoreBase}/dateTimeSlots?documentId=${slotId}`,
				{
					method: 'POST',
					body: {
						fields: encodeFields({
							id: slotId,
							programYear: configuration.year,
							dateTime: new Date(
								`${configuration.year}-12-12T18:00:00Z`,
							),
							maxSlots: 10000,
							enabled: true,
							slotsReserved: 0,
						}),
					},
				},
			);
			process.on('SIGINT', () =>
				journal.stop('Operator interrupted the run.'),
			);
			process.on('SIGTERM', () =>
				journal.stop('Process termination requested.'),
			);
			monitorTimer = setInterval(() => {
				if (!monitorWork)
					monitorWork = monitor().finally(() => {
						monitorWork = undefined;
					});
			}, 60_000);
			const { browserSmoke } = await import('./browser-smoke.mjs');
			const completed = [];
			if (skipSmoke)
				journal.record({
					type: 'smoke-skipped',
					reason: 'Operator selected --skip-smoke after prior browser validation.',
				});
			for (
				let index = 0;
				index < (skipSmoke ? 0 : TARGETS.smoke);
				index++
			) {
				const account = fixture();
				journal.record({
					type: 'journey-attempt',
					phase: 'browser-smoke',
					index,
				});
				await browserSmoke(
					configuration.config,
					account,
					slotId,
					configuration.year,
					journal,
					directory,
					appCheck.browserDebugToken,
				);
				journal.record({
					type: 'journey-complete',
					phase: 'browser-smoke',
					index,
				});
				completed.push(
					await api.readRegistration(
						'smoke-verification',
						await api.signIn('smoke-verification', account),
					),
				);
			}
			if (command === 'run') {
				const signup = async (phase) => {
					const account = fixture();
					const session = await api.prepare(
						phase,
						account,
						slotId,
						configuration.year,
					);
					const registration = await api.complete(
						phase,
						account,
						session,
					);
					completed.push(registration);
					return { account, session, registration };
				};
				await arrivals(
					journal,
					'calibration',
					TARGETS.calibration.count,
					TARGETS.calibration.durationMs,
					() => signup('calibration'),
				);
				await monitor();
				journal.assertRunning();
				// Delayed metrics are allowed during smoke only, never at the main-load gate.
				journal.record({
					type: 'instances',
					...(await instanceEvidence(client, proof.snapshot)),
				});
				const projection = costCeiling(
					proof.snapshot,
					(Date.now() - started) / 1000,
					3600,
				);
				journal.record({ type: 'calibration-budget', ...projection });
				enforceBudget(projection, true);
				await arrivals(
					journal,
					'signup-sustained',
					TARGETS.signup.count,
					TARGETS.signup.durationMs,
					() => signup('signup-sustained'),
				);
				for (
					let index = 0;
					index < TARGETS.signupBurst.repetitions;
					index++
				) {
					const phase = `signup-burst-${index + 1}`;
					await arrivals(
						journal,
						phase,
						TARGETS.signupBurst.count,
						TARGETS.signupBurst.durationMs,
						() => signup(phase),
					);
					await delay(TARGETS.drainMs);
				}
				const prepared = [];
				for (
					let index = 0;
					index < TARGETS.signupCluster.count;
					index++
				) {
					const account = fixture();
					prepared.push({
						account,
						session: await api.prepare(
							'cluster-preparation',
							account,
							slotId,
							configuration.year,
						),
					});
				}
				await arrivals(
					journal,
					'signup-cluster',
					9,
					1000,
					async (index) =>
						completed.push(
							await api.complete(
								'signup-cluster',
								prepared[index].account,
								prepared[index].session,
							),
						),
				);
				const staff = [];
				for (let index = 0; index < TARGETS.staff.sessions; index++) {
					const account = fixture();
					await api.prepare(
						'staff-preparation',
						account,
						slotId,
						configuration.year,
					);
					await client.request(
						`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`,
						{
							method: 'POST',
							body: {
								localId: account.uid,
								customAttributes: JSON.stringify({
									roles: ['admin', 'checkin'],
								}),
							},
						},
					);
					journal.record({
						type: 'staff-claims',
						uid: account.uid,
						roles: ['admin', 'checkin'],
					});
					staff.push(await api.signIn('staff-preparation', account));
				}
				let nextRegistration = 0;
				const checkedIn = async (
					phase,
					index,
					mix,
					preparedRegistration,
				) => {
					const session = staff[index % staff.length];
					journal.assertRunning();
					const onsite = mix && index % 11 === 0;
					const edit = mix && index % 11 === 1;
					let registration;
					let account;
					if (onsite) {
						account = fixture();
						registration = {
							uid: `${runId}-${account.id}`,
							firstName: account.firstName,
							lastName: account.lastName,
							emailAddress: account.emailAddress,
							zipCode: '80202',
							qrcode: 'onsite',
							dateTimeSlot: { id: slotId },
							children: [0, 1, 2].map((id) =>
								childFixture(configuration.year, id),
							),
						};
					} else {
						registration =
							preparedRegistration ??
							completed[nextRegistration++];
						if (!preparedRegistration) {
							const scan = await api.call(
								phase,
								'resolveRegistrationScan',
								{
									code: registration.qrcode,
									inputMethod: 'manual',
								},
								session,
							);
							if (
								scan.disposition !== 'eligible' ||
								scan.registration.uid !== registration.uid
							)
								throw new Error('Unexpected scan disposition.');
						}
						// Use canonical date-only child inputs, not serialized Firestore Timestamp objects.
						registration = {
							...registration,
							children: [0, 1, 2].map((id) =>
								childFixture(configuration.year, id),
							),
						};
						if (edit) registration.children[0].firstName = 'Edited';
					}
					journal.record({
						type: 'checkin-intent',
						phase,
						uid: registration.uid,
						...(onsite
							? { emailAddress: account.emailAddress }
							: {}),
						onsite,
						edit,
					});
					const coupons = await api.call(
						phase,
						onsite
							? 'onSiteRegistration'
							: edit
								? 'checkInWithEdit'
								: 'checkIn',
						onsite
							? registration
							: { registration, inputMethod: 'manual' },
						session,
					);
					if (coupons !== 3)
						throw new Error('Expected three coupons.');
					if (onsite) {
						const matches = await query(
							client,
							'onsiteregistrations',
							[['emailAddress', 'EQUAL', account.emailAddress]],
						);
						if (matches.length !== 1)
							throw new Error(
								'On-site registration is missing or duplicated.',
							);
						registration.uid = matches[0].id;
					}
					const original = await document(
						client,
						`checkins/${registration.uid}`,
					);
					journal.record({
						type: 'checkin-completed',
						phase,
						uid: registration.uid,
						coupons,
						onsite,
						edit,
						...(onsite
							? { emailAddress: account.emailAddress }
							: {}),
						originalCheckInAt: original?.checkInDateTime,
					});
				};
				await arrivals(
					journal,
					'staff-sustained',
					TARGETS.staff.count,
					TARGETS.staff.durationMs,
					(index) => checkedIn('staff-sustained', index, true),
				);
				await arrivals(journal, 'staff-minute', 23, 60_000, (index) =>
					checkedIn('staff-minute', index, false),
				);
				const clusterRegistrations = [];
				for (let index = 0; index < 5; index++) {
					const registration = completed[nextRegistration++];
					const scan = await api.call(
						'staff-cluster-preparation',
						'resolveRegistrationScan',
						{ code: registration.qrcode, inputMethod: 'manual' },
						staff[index],
					);
					if (
						scan.disposition !== 'eligible' ||
						scan.registration.uid !== registration.uid
					)
						throw new Error(
							'Cluster registration is not eligible.',
						);
					clusterRegistrations.push(registration);
				}
				await arrivals(journal, 'staff-cluster', 5, 1000, (index) =>
					checkedIn(
						'staff-cluster',
						index,
						false,
						clusterRegistrations[index],
					),
				);
				const duplicate = completed[nextRegistration++];
				let accepted = 0;
				await Promise.all(
					staff.map(async (session) => {
						const scan = await api.call(
							'duplicate-scans',
							'resolveRegistrationScan',
							{ code: duplicate.qrcode, inputMethod: 'manual' },
							session,
						);
						if (scan.disposition.startsWith('duplicate-')) return;
						if (scan.disposition !== 'eligible')
							throw new Error(
								'Unexpected duplicate scan disposition.',
							);
						try {
							const coupons = await api.call(
								'duplicate-scans',
								'checkIn',
								{
									registration: {
										...duplicate,
										children: [0, 1, 2].map((id) =>
											childFixture(
												configuration.year,
												id,
											),
										),
									},
									inputMethod: 'manual',
								},
								session,
								{ expectedCodes: ['ALREADY_EXISTS'] },
							);
							if (coupons !== 3)
								throw new Error(
									'Duplicate coupon count is invalid.',
								);
							accepted++;
						} catch (error) {
							if (error.code !== 'ALREADY_EXISTS') throw error;
						}
					}),
				);
				if (accepted !== 1)
					throw new Error(
						'Concurrent scans did not produce exactly one check-in.',
					);
				journal.record({
					type: 'checkin-completed',
					phase: 'duplicate-scans',
					uid: duplicate.uid,
					coupons: 3,
					originalCheckInAt: (
						await document(client, `checkins/${duplicate.uid}`)
					).checkInDateTime,
				});
				const recovery = fixture();
				const recoverySession = await api.prepare(
					'interruption-preparation',
					recovery,
					slotId,
					configuration.year,
				);
				const mutationId = randomUUID();
				journal.record({
					type: 'completion-intent',
					phase: 'interruption',
					uid: recovery.uid,
					fixture: recovery.id,
					mutationId,
				});
				const controller = new AbortController();
				const timer = setTimeout(() => controller.abort(), 50);
				let interrupted = false;
				try {
					await api.call(
						'interruption',
						'completeRegistration',
						{ mutationId },
						recoverySession,
						{
							signal: controller.signal,
							expectedCodes: ['AbortError'],
						},
					);
				} catch (error) {
					if (error.name !== 'AbortError') throw error;
					interrupted = true;
				} finally {
					clearTimeout(timer);
				}
				if (!interrupted)
					throw new Error(
						'The planned client interruption did not occur; recovery coverage is incomplete.',
					);
				journal.record({
					type: 'fault-injected',
					phase: 'interruption',
					uid: recovery.uid,
					mutationId,
				});
				await api.complete(
					'interruption-recovery',
					recovery,
					recoverySession,
					mutationId,
				);
				await monitor();
				journal.assertRunning();
				const verification = await verifyRun(client, journal, slotId);
				if (!verification.passed)
					throw new Error('Business verification failed.');
				await verifyResources(verification);
				const latencyFailures = journal
					.summary()
					.filter(
						(item) =>
							!item.operation.startsWith('interruption/') &&
							(item.unexpectedErrors ||
								item.underTwoSecondsFraction < 0.99),
					);
				if (latencyFailures.length)
					throw new Error(
						'One or more operations failed the 99% under two seconds gate.',
					);
				journal.record({
					type: 'acceptance',
					passed: true,
					sesDeliveryVerified: false,
					productionAcceptanceVerified: false,
				});
			} else {
				await monitor();
				journal.assertRunning();
				const verification = await verifyRun(client, journal, slotId);
				if (!verification.passed)
					throw new Error('Smoke business verification failed.');
				await verifyResources(verification);
				journal.record({
					type: 'smoke-acceptance',
					passed: true,
					completedJourneys: completed.length,
					calibrationAndLoadRun: false,
					browserAppCheckProvider: 'registered-test-debug',
					recaptchaAttestationVerified: false,
				});
			}
		}
	}
} catch (error) {
	journal.stop(error.message);
	if (error.report) journal.record({ type: 'isolation', ...error.report });
	console.error(error.message);
	process.exitCode = 1;
	if (
		['run', 'smoke'].includes(command) &&
		journal.events.some((event) => event.type === 'account-intent')
	) {
		try {
			await verifyRun(client, journal, slotId);
		} catch (verificationError) {
			journal.record({
				type: 'verification-error',
				reason: verificationError.message,
			});
		}
	}
} finally {
	clearInterval(monitorTimer);
	await monitorWork;
	writeFileSync(
		resolve(directory, 'summary.json'),
		JSON.stringify(
			{
				runId,
				project: PROJECT,
				stopped:
					journal.stopReason ??
					journal.events.findLast((event) => event.type === 'stop')
						?.reason ??
					null,
				latestVerificationPassed:
					journal.events.findLast(
						(event) => event.type === 'verification',
					)?.passed ?? null,
				latestResourceVerificationPassed:
					journal.events.findLast(
						(event) => event.type === 'resource-verification',
					)?.passed ?? null,
				operations: journal.summary(),
				sesDeliveryVerified: false,
				productionAcceptanceVerified: false,
			},
			null,
			2,
		),
	);
	console.log(`Evidence: ${directory}`);
}
