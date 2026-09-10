# Release readiness and seasonal operations

This is the operating contract for test promotion, production promotion,
signup launch, and event-day check-in. A build or deploy alone is not release
approval.

Create release reports and deployment evidence directly in the Obsidian vault
under `Archive/Releases`, following the [recording policy](README.md#recording-future-work).
Keep this page as the maintained release procedure; do not append execution results.

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

## Remote Config prerequisites

Public controls use the unconditional client-template parameter
`santashop_public_parameters`. Follow [the migration release order](remote-config.md)
before promoting dependent code. Keep the legacy Firestore settings document
intact and require older applications to upgrade.

Provision the dedicated reader and publisher identities, publish reviewed target
settings, and generate matching release defaults before deployment. Configuration
checks no longer share Firestore transaction atomicity; cached settings and
in-flight work can outlive a publication.

The IAM-private gateway has a 60-read release budget. Deployment checks verify
its identity, private invoker policy, instance limit, and canonical URI. See
[the gateway capacity model](remote-config.md#identities-and-capacity). Verify
actual request rates and replacement/failure behavior before promotion.

Complete deployed test measurements for client delivery time, backend
propagation, recovery, rollback, and API request counts. Passing PR gates and
local migration checks does not satisfy these deployed acceptance requirements.

## Traffic and capacity assumptions

Use the [configured load workload](../scripts/load/acceptance.md#configured-workload) and
its source constants. Review sustained arrivals, short bursts, simultaneous
completions, staff sessions, and the mix of staff edits/on-site registrations
before each campaign. Store dated traffic measurements in the project vault.

A signup journey makes several callable and Firestore requests. Exercise the
complete account, draft, child, appointment, and completion journey. One HTTP
response is not one completed customer journey. Keep historical successful
transactions separate from assumptions about abandoned attempts and devices.

## Function resource profiles

All customer and staff callables use bounded second-generation concurrency and
maximum instances. These limits bound configured concurrency and cost. Verify
workload headroom with measurements for the deployed revision.

| Profile | Functions | CPU | Memory | Concurrency | Maximum instances | Warm instances |
| ----------------- | ---------------------------------- | --: | ------: | ----------: | ----------------: | -------------------------------: |
| Standard customer | account/profile/email changes | 1 | 256 MiB | 10 | 5 | 0 |
| Signup draft | save/delete child, set appointment | 1 | 256 MiB | 20 | 10 | 0 |
| Signup completion | complete registration | 1 | 512 MiB | 20 | 10 | `SANTASHOP_SIGNUP_MIN_INSTANCES` |
| New account | account creation and QR generation | 1 | 512 MiB | 20 | 10 | `SANTASHOP_SIGNUP_MIN_INSTANCES` |
| Event hot path | check-in and scan resolution | 1 | 256 MiB | 20 | 5 | `SANTASHOP_EVENT_MIN_INSTANCES` |
| Event standard | edit/on-site/pre-registration | 1 | 256 MiB | 10 | 3 | 0 |
| Low volume/admin | templates, staff, owner operations | 1 | 256 MiB | 10 | 3 | 0 |

The configured ceilings provide 200 concurrent requests for each signup hot
path and 100 for each check-in hot path. These are configured ceilings, not
measured throughput or evidence of downstream Auth, Firestore, Storage, or SES
capacity.

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

`Dependency Review` runs ordinary `pnpm audit` once for dependency-changing PRs
and can be run manually. The workflow uploads its audit output and flags a
non-zero exit; it is informational, not a clean-security certificate. Joel, as
maintainer, reviews new findings on those PRs and records an upgrade or explicit
risk decision there before promotion. A network/audit failure is not a clean
result. Run `pnpm run audit:security` for the same ordinary workspace audit and
`pnpm audit --prod` to inspect production dependency exposure.

There is no custom advisory allowlist or installed-parser exception analyzer.
Removing the repeated UI/Functions audit-wrapper runs changes when this signal
is collected; it does not establish that an advisory is unreachable or that an
old acceptance remains valid. Reassess accepted risks when dependencies or
usage change. The Functions deployment's separate **blocking** production-only
artifact audit remains in place.

The workspace build-script allowlist remains limited to known Firebase,
Angular, bundler, and native-helper dependencies. Do not broaden it to silence
installation warnings without reviewing the package's build script.

## Required release gates

For every merge to `master`, the test backend workflow must:

1. install from the locked dependency graph;
2. pass the production-dependency audit of the prepared Functions artifact and review applicable dependency-PR findings;
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
[hosted load acceptance](../scripts/load/acceptance.md). No hosted smoke, account
creation, or fixture seeding may start until the deployed email isolation gate
proves credential removal, independent network denial, sink routing, and old
worker retirement. The pass criteria are:

- no unexpected 4xx/5xx responses;
- at least 99% of callable responses under 2 seconds, excluding email delivery;
- every valid attempted signup completes under the configured workload;
- exactly one check-in record for repeated or concurrent scans of one code;
- no lost registration or slot-counter writes;
- simulated email work drains within five minutes; counters reconcile within
  two scheduler intervals plus two minutes;
- no Function reaches its maximum-instance ceiling for five continuous minutes;
- recovery after an injected callable failure succeeds without duplicate data.

Stop new arrivals on isolation drift, target mismatch, data corruption,
unexpected errors above 1% in a rolling minute, or the $20 estimated operating
limit. The total budget is $25, including a $5 verification reserve. Fixtures
remain in test. A sink run does not establish SES delivery or production acceptance.

Store the test parameters, commit SHA, UTC start/end, result counts, p50/p95/p99,
and relevant Monitoring links with the release record in the project vault. A small emulator test is
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
