# Release readiness and seasonal operations

This is the operating contract for test promotion, production promotion,
signup launch, and event-day check-in. A build or deploy alone is not release
approval.

## Manual deployment without repeating tests

The app, admin, and Functions release workflows accept `deployment_target`
(`test` or `prod`), `release_ref`, and `skip_tests`. The default remains a
production promotion with tests enabled. Set `skip_tests` to `true` for a manual
run that should omit automated test suites and their browser setup. The workflow
summary records the selected target and ref and states that tests were skipped.

Dependency installation, builds, artifact checks, environment readiness, and
live deployment verification still run. Push-triggered deployments and pull
request checks keep their normal test gates. A successful skipped-test deployment
is deployment evidence only; cite the separate test run when reporting validation.

## Remote Config migration prerequisite

For beta.3, public controls move to the unconditional client-template parameter
`santashop_public_parameters`. Follow [the migration release order](remote-config.md)
before promoting dependent code. Keep the legacy Firestore settings document
intact and require older applications to upgrade.

Provision the dedicated reader and publisher identities, publish reviewed target
settings, and generate matching release defaults before deployment. Configuration
checks no longer share Firestore transaction atomicity; cached settings and
in-flight work can outlive a publication.

The September 7 inspection found 60 template reads per minute in each project.
The initial direct-polling design required 600. Cloud Quotas rejected that
increase as unsupported. The repair introduces an IAM-private gateway
with a 60-read budget and a deployment check for its identity, private invoker
policy, instance limit, and canonical URI. Consumer capacity is unchanged. See
[the gateway capacity model](remote-config.md#identities-and-capacity). Verify
actual request rates and replacement/failure behavior before promotion.

Complete deployed test measurements for client delivery time, backend
propagation, recovery, rollback, and API request counts. Passing PR gates and
[local migration checks](remote-config-validation.md) does not satisfy these
deployed acceptance requirements.

## Traffic and capacity assumptions

- Retained 2025 registration timestamps show peaks of 713 completions per
  rolling 15 minutes, 90 per minute, and six per second. With 50% headroom,
  test 1.2 signup journeys/second for 15 minutes, three one-minute bursts of
  2.25/second, and nine prepared completions within one second.
- Retained 2025 check-in timestamps show peaks of 54 per rolling five minutes,
  15 per minute, and three per second. Test ten authenticated staff sessions
  sharing 81 check-ins per five minutes for 15 minutes, then separate bursts
  of 23 per minute and five within one second. Include about 9% on-site
  registrations and 9% staff edits. Device concurrency is a coverage choice.
- A signup journey makes several callable and Firestore requests. Load tests
  must exercise the complete account, draft, child, appointment, and completion
  journey rather than treating one HTTP response as one customer.

## Function resource profiles

All customer and staff callables use bounded second-generation concurrency and
maximum instances. These limits protect cost while leaving substantial margin
above the expected traffic.

| Profile           | Functions                          | CPU |  Memory | Concurrency | Maximum instances |                   Warm instances |
| ----------------- | ---------------------------------- | --: | ------: | ----------: | ----------------: | -------------------------------: |
| Standard customer | account/profile/email changes      |   1 | 256 MiB |          10 |                 5 |                                0 |
| Signup draft      | save/delete child, set appointment |   1 | 256 MiB |          20 |                10 |                                0 |
| Signup completion | complete registration              |   1 | 256 MiB |          20 |                10 | `SANTASHOP_SIGNUP_MIN_INSTANCES` |
| New account       | account creation and QR generation |   1 | 512 MiB |          20 |                10 | `SANTASHOP_SIGNUP_MIN_INSTANCES` |
| Event hot path    | check-in and scan resolution       |   1 | 256 MiB |          20 |                 5 |  `SANTASHOP_EVENT_MIN_INSTANCES` |
| Event standard    | edit/on-site/pre-registration      |   1 | 256 MiB |          10 |                 3 |                                0 |
| Low volume/admin  | templates, staff, owner operations |   1 | 256 MiB |          10 |                 3 |                                0 |

The configured ceilings provide 200 concurrent requests for each signup hot
path and 100 for each check-in hot path. This is capacity headroom, not a claim
that downstream Auth, Firestore, Storage, or SES limits are unlimited.

Warm instances are deliberately temporary:

1. Leave both GitHub repository variables absent or set to `0` during normal
   operation. This is the lowest always-on cost.
2. Before opening signups, set `PROD_SANTASHOP_SIGNUP_MIN_INSTANCES=1`, promote
   the tested ref, and confirm one healthy warm instance for `newAccount` and
   `completeRegistration`.
3. After the launch surge, return the variable to `0` and promote the same
   tested code with the new runtime configuration.
4. Before event check-in, set `PROD_SANTASHOP_EVENT_MIN_INSTANCES=1`. Return it
   to `0` after the event closes.
5. Raise above `1` only when a measured load test shows a need. Never raise a
   maximum or minimum merely because traffic might increase.

## Accepted overbooking policy

Limited appointment overbooking is acceptable. The system is not required to
provide a strict capacity hard stop or waitlist. Concurrent customers may
select a slot near its displayed capacity, and `slotsReserved` is reconciled by
the scheduled counter job. Overbooking must not corrupt registrations, create
duplicate check-ins, or prevent staff from serving customers. Staff should use
the schedule and registration reports to redistribute operational capacity when
a slot exceeds its target.

## Dependency security

Run `pnpm run audit:security` from the workspace root. It audits the complete
production and development dependency graph and fails when a new advisory is
present. Production dependencies must also remain clean under
`pnpm audit --prod`.

The gate excludes advisories for which the registry publishes no resolution.
There are currently two such `image-size` advisories: the registry marks all
versions through 2.0.2 as affected, while this locked graph contains version
0.5.5. That version has no ICNS, JXL, or HEIF parser—the only parsers named by
GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq—and this repository has no Less
source files. Recheck the exception whenever Angular replaces its Less
toolchain or the lockfile changes the installed `image-size` version. Any new
unfixable advisory must receive an equivalent reachability review before the
release proceeds.

The workspace build-script allowlist is intentional and limited to known
Firebase, Angular, bundler, and native-helper dependencies. Angular runs
zoneless and tests run with Vitest, so the unused `zone.js` and Jest peers are
intentionally not installed.

`firebase-tools` 15.29.0 also installs `stream-json` 1.9.1. Advisory
GHSA-528h-pc64-c93x affects the package's Pick, Ignore, Filter, and Replace
filters. Firebase CLI uses those filters in Realtime Database import, Auth
import, and Next.js framework handling. This repository's CI and release
commands use none of those paths, and `firebase-tools` does not yet accept the
fixed `stream-json` major version. The audit gate permits only this exact
dependency path and fixed-version range. Remove the exception when Firebase CLI
adopts `stream-json` 3.5.0 or later.

## Required release gates

For every merge to `master`, the test backend workflow must:

1. install from the locked dependency graph;
2. pass the full dependency security audit;
3. pass Function unit and emulator integration suites;
4. deploy Functions, Firestore rules/indexes, and Storage rules as one test
   backend release;
5. remove retired Functions with the non-interactive `--force` deploy;
6. compare the live Function list to production source exports and fail on any
   missing or unexpected Function;
7. verify that every Firebase-managed Scheduler job, Cloud Tasks queue, and
   Eventarc trigger exists, is enabled, and matches its source configuration;
8. complete customer and admin end-to-end suites with every Axe WCAG 2.2 AA
   violation treated as a failure.

The test project's unused Realtime Database instance is disabled. Test releases
must not target it because Firebase aborts the entire backend deployment before
Functions are updated. The manual production release continues to deploy
Realtime Database rules to the active production instance. Realtime Database
rule changes therefore require explicit production-release review; do not claim
that the test deployment validated them.

### Backend deployment prerequisites

Provision these APIs in each Firebase project before release; the CI deployment
identity intentionally cannot enable arbitrary project services:

- Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, and Eventarc;
- Pub/Sub, Cloud Scheduler, and Cloud Tasks;
- Firestore, Cloud Storage, and Firebase Storage.

The Functions deployment identity needs `roles/firebase.admin`,
`roles/cloudfunctions.admin`, `roles/datastore.indexAdmin`, and
`roles/serviceusage.serviceUsageConsumer`. Scheduled and task-queue Functions
also require `roles/cloudscheduler.admin` and `roles/cloudtasks.queueAdmin` so
the deployment can create, update, and remove their managed resources. Keep the
deployment identity separate from the runtime identity. Firebase's
service-agent preflight also requires:

- `roles/iam.serviceAccountTokenCreator` for the Pub/Sub service agent;
- `roles/run.invoker` for the default compute service account;
- `roles/eventarc.eventReceiver` for the default compute service account.

The owner-operation task worker intentionally leaves `invoker` unspecified.
Firebase then keeps the worker private and limits enqueueing to identities with
both the Cloud Tasks enqueuer and Functions invoker roles. Do not replace this
default with `invoker: 'private'`; Firebase CLI 15 cannot reconcile that explicit
sentinel when it updates an existing second-generation task function.

The release does not upload the pnpm workspace package directly. It builds a
temporary `.firebase-functions-deploy` directory containing compiled output,
the selected project's environment file, concrete runtime dependency versions,
and an npm lockfile. This is required because Google Cloud Build uses npm and
cannot install pnpm `catalog:` dependency specifiers.

Before production promotion, repeat the test-environment critical journeys with
production-equivalent runtime settings. Do not promote when a deploy, parity
check, security-rule test, accessibility check, or critical journey is red.
After each Hosting deploy, run the hosted smoke journeys, investigate every
unexpected browser console or page error, and verify the configured security
headers on both hosted apps. Local Angular development-server responses are not
evidence that Firebase Hosting applied those headers.

## Load and resilience gate

Run against the test project, never production. Follow
[historical load acceptance](load-acceptance.md). No hosted smoke, account
creation, or fixture seeding may start until the deployed email isolation gate
proves credential removal, independent network denial, sink routing, and old
worker retirement. The pass criteria are:

- no unexpected 4xx/5xx responses;
- at least 99% of callable responses under 2 seconds, excluding email delivery;
- every valid attempted signup completes under the historical targets above;
- exactly one check-in record for repeated or concurrent scans of one code;
- no lost registration or slot-counter writes;
- simulated email work drains within five minutes; counters reconcile within
  two scheduler intervals plus two minutes;
- no Function reaches its maximum-instance ceiling for five continuous minutes;
- recovery after an injected callable failure succeeds without duplicate data.

Stop new arrivals on isolation drift, target mismatch, data corruption,
unexpected errors above 1% in a rolling minute, or the $20 estimated operating
limit. The total budget is $25, including a $5 verification reserve. Fixtures
remain in test. SES delivery and production acceptance remain unverified.

Store the test parameters, commit SHA, UTC start/end, result counts, p50/p95/p99,
and relevant Monitoring links with the release record. A small emulator test is
useful for correctness but is not evidence of cloud latency or quota headroom.

## Monitoring and incident triggers

Before opening signups or check-in, confirm dashboards and alerts for:

- callable error rate above 1% for five minutes;
- p95 callable latency above two seconds for five minutes;
- instance count at a configured maximum for five minutes;
- registration-email failures or stale `sending` work;
- scheduled backup failure or a backup older than 26 hours during November and
  December;
- scheduled counter/statistics job failure;
- owner operation failure or stalled work;
- elevated suspicious/duplicate scan activity.

The first responder pauses nonessential admin work, records the affected commit
and project, checks Function and Firestore health, and uses feature controls to
disable only the affected customer/staff action. Roll back Hosting to the last
known-good release when the UI is at fault; promote the last tested backend ref
when a backend regression is confirmed. Never delete live customer data as an
incident response shortcut.

## Backup and restore evidence

Firestore's scheduled export is only one part of recovery. Before the season:

1. run and record a Firestore export;
2. archive the export together with Firebase Storage objects using the owner
   backup workflow;
3. restore both into an isolated project;
4. verify users, registrations, schedule, check-ins, email-template assets, and
   QR objects by count and a sampled customer journey;
5. record restore duration and any manual steps;
6. retain daily event-period backups for 30 days and retain the post-event full
   archive until it is intentionally removed.

Follow [`yearly-startup.md`](yearly-startup.md) for the controlled annual reset
and archive procedure. A backup is not considered valid until the isolated
restore drill succeeds.

## Runtime identity

`SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT` optionally pins all Functions to a
dedicated runtime service account instead of the deployment identity. Provision
that identity per Firebase project and grant only the Firebase Auth, Firestore,
Storage, Cloud Tasks, logging, and export permissions required by these
Functions. Set the environment value only after the identity and permissions
exist; an invalid value intentionally blocks deployment. The GitHub deployment
service account remains separate and must not be used as the runtime identity.
