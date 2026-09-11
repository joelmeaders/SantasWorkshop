# Release readiness and seasonal operations

This is the operating contract for test promotion, production promotion,
signup launch, and event-day check-in. A build or deploy alone is not release
approval.

Create release reports and deployment evidence directly in the Obsidian vault
under `Archive/Releases`, following the [recording policy](README.md#recording-future-work).
Keep this page as the maintained release procedure; do not append execution results.

## Exact-SHA release evidence and owner approval

Run app, admin, and Functions release workflows from `master`. The owner selects
`release_ref` and invokes production deployment. The selection can be a release
tag, branch, or commit. The gate resolves it once to a full immutable commit
that must exist on `master`. Every later checkout uses that resolved SHA.

The gate runs from the workflow's trusted source before candidate installation,
builds, or production credentials. It requires only `contents: read` and
`actions: read`. It automatically discovers successful runs from the required
workflows, then verifies their actual checkout markers, jobs, and test steps.
No manual run IDs, repeated-commit approval, or test-skip input is required.

Each producing job records `git rev-parse HEAD` immediately after checkout,
before running candidate code. A dispatch run's `head_sha` identifies its
workflow source and can differ from its tested SHA. Discovery therefore checks
checkout markers rather than filtering dispatches by `head_sha`. PR heads and
synthetic merge commits do not substitute for release evidence.

| Promotion | Required successful validation for the exact SHA | Required successful test deployment |
| --- | --- | --- |
| Functions | `unit_tests`: Functions unit tests; `integration_tests`: Functions integration tests; both `e2e (app) / test` and `e2e (admin) / test`: respective browser suites | Functions `deploy_test`, including live resource checks, in `santas-workshop-test` |
| App | Both app and admin `release / validate_release`: respective E2E, core tests, and target unit tests; canonical `storybook_behavior` | App Hosting in `santas-workshop-test` |
| Admin | Both app and admin `release / validate_release`: respective E2E, core tests, and target unit tests; canonical `storybook_behavior` | Admin Hosting in `santas-workshop-test` |

Both hosting validations remain required for every hosting promotion because
core, models, configuration, and browser behavior cross app boundaries.
Functions browser jobs use `e2e-target.yml` on separate runners. The gate checks
all evidence-producing workflow files, including reusable workflows and the
verifier, against the trusted current source. Changed producers require new evidence.

Missing, failed, cancelled, incomplete, duplicate, skipped, untrusted, or
wrong-SHA evidence blocks promotion. Wrong repositories, workflow identities,
and deployment targets also block promotion. API failures stop the gate.
Discovery examines up to 1,000 recent successful runs per required workflow.
The gate rechecks selected run attempts before accepting them. Its summary lists
the resolved commit and the evidence links it found.

To deploy to production:

1. Open the target's release workflow from `master`.
2. Select the release in `release_ref`, leave `deployment_target=prod`, and run it.
3. Inspect the gate summary and the separate deployment result.

The owner's dispatch is the production approval. There is no additional typed
approval or reviewer step. The operational acceptance requirements below still
apply. These workflow checks do not prove hosted journeys, inbox delivery, or
production capacity.

If evidence is missing, run the indicated test workflow from `master` with the
same resolved SHA and `deployment_target=test`. For missing Storybook evidence,
dispatch its existing workflow with `release_ref` set to that SHA. Then retry
production. A path filter can omit one of these runs, so the gate never assumes
that a merged commit has complete release evidence.

### Test execution and rollback

Production automatically reuses verified tests. Test deployments always run
fresh suites and produce new evidence. Dependency installation, builds,
artifact audits, parity checks, and deployment checks remain in place.

UI jobs prepare shared libraries, run unit tests, and verify builds before
browser tests. Release E2E changes generated source configuration but does not
write the verified Hosting output. The job restores the selected source
configuration and compares Hosting file hashes after E2E. Changed output blocks
deployment. A Functions test deployment waits for unit tests,
integration tests, and both isolated browser suites.

To roll back, select an earlier release on `master` through the same production
workflow. If evidence expired, falls outside discovery's search window, or uses
an older producer, run fresh test validation for that SHA first. There is no
silent fallback or bypass, and a rollback does not authorize customer data changes.

Run `node --test scripts/release-*.test.mjs` for verifier fixtures and the actual
YAML decision/dependency dry run. The harness uses a harmless deployment sentinel
without production credentials. It does not execute GitHub's runner or validate
hosted IAM, deployment services, browser timing, or real email delivery.

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

| Profile           | Functions                          | CPU |  Memory | Concurrency | Maximum instances |                   Warm instances |
| ----------------- | ---------------------------------- | --: | ------: | ----------: | ----------------: | -------------------------------: |
| Standard customer | account/profile/email changes      |   1 | 256 MiB |          10 |                 5 |                                0 |
| Signup draft      | save/delete child, set appointment |   1 | 256 MiB |          20 |                10 |                                0 |
| Signup completion | complete registration              |   1 | 512 MiB |          20 |                10 | `SANTASHOP_SIGNUP_MIN_INSTANCES` |
| New account       | account creation and QR generation |   1 | 512 MiB |          20 |                10 | `SANTASHOP_SIGNUP_MIN_INSTANCES` |
| Event hot path    | check-in and scan resolution       |   1 | 256 MiB |          20 |                 5 |  `SANTASHOP_EVENT_MIN_INSTANCES` |
| Event standard    | edit/on-site/pre-registration      |   1 | 256 MiB |          10 |                 3 |                                0 |
| Low volume/admin  | templates, staff, owner operations |   1 | 256 MiB |          10 |                 3 |                                0 |

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

New customer selections, submissions, and reschedules require the current
program year, operator permission (`enabled=true`), and a valid future start.
The latest stored `slotsReserved` must be below `maxSlots`. The server rejects
these actions when its current time reaches the appointment start. Display
appointment times in `America/Denver`. Previously submitted appointments and
staff check-in/on-site workflows retain their existing behavior after the start.

A selection has no separate age limit. Entering review confirms the current
appointment state. Resuming a tab exits review and refreshes that state. If the
appointment start changed, the customer must select and review it again. A
successful mutation receipt can still replay after a later closure or cutoff.

`enabled` records the operator's permission. The counter job updates exact
`slotsReserved` counts and never changes `enabled`. Existing disabled slots
remain closed until an operator enables them. Historical closure causes cannot
be inferred safely. A new `maxSlots` value applies even if counts did not change.

The configured counter schedule runs every five minutes in November and
December. Operators can manually increase its frequency during high demand,
inspect stored counts, close a slot, or increase its capacity. Concurrent
selections can exceed capacity before counts refresh. This remains a soft
capacity policy and does not reserve capacity atomically for each selection.

## Dependency security

The Functions deployment retains its separate blocking production-dependency
audit of the disposable deployment artifact. Review its findings before promotion.

The workspace build-script allowlist remains limited to known Firebase,
Angular, bundler, and native-helper dependencies. Do not broaden it to silence
installation warnings without reviewing the package's build script.

## Required release gates

For every merge to `master`, the test backend workflow must:

1. install from the locked dependency graph;
2. pass the production-dependency audit of the prepared Functions artifact;
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

### Private owner export signing

Owner export downloads require [`iam.serviceAccounts.signBlob`](https://docs.cloud.google.com/storage/docs/authentication/creating-signatures)
on the runtime service account. The supported configuration is an unconditional
`roles/iam.serviceAccountTokenCreator` binding from that account to itself,
on that service-account resource. Do not grant this role project-wide.
Custom roles, inherited grants, and conditional grants can also provide signing
access, but the release check does not evaluate those alternatives.

Before enabling the release gate, give the CI deployment identity
`roles/iam.serviceAccountViewer` on the same runtime service-account resource.
Its existing Functions, Firebase, and Service Usage roles must also allow
`cloudfunctions.functions.get`, `resourcemanager.projects.get`, and
`serviceusage.services.get`. This permits inspection without giving the deployer
signing or IAM mutation rights. Configure test and production independently;
the checker never changes IAM or enables APIs.

An authorized operator can use these PowerShell commands after selecting the
intended project and its deployment identity. For production, follow the
production approval procedure before applying grants.

```powershell
$exportProject = 'santas-workshop-test'
$exportDeployer = 'github-action-298411435@santas-workshop-test.iam.gserviceaccount.com'
$exportRuntime = gcloud functions describe callableGetOwnerExportUrl --gen2 --region=us-central1 --project=$exportProject --format='value(serviceConfig.serviceAccountEmail)'
if ($LASTEXITCODE -ne 0 -or -not $exportRuntime) { throw 'Cannot identify the export runtime.' }
gcloud iam service-accounts describe $exportRuntime --project=$exportProject --format='table(email,projectId,disabled)'
# Verify the displayed identity and project before applying either grant.
gcloud iam service-accounts add-iam-policy-binding $exportRuntime --project=$exportProject --member="serviceAccount:$exportRuntime" --role=roles/iam.serviceAccountTokenCreator --condition=None
gcloud iam service-accounts add-iam-policy-binding $exportRuntime --project=$exportProject --member="serviceAccount:$exportDeployer" --role=roles/iam.serviceAccountViewer --condition=None
$priorExportToken = $env:REMOTE_CONFIG_ACCESS_TOKEN
try {
  $env:REMOTE_CONFIG_ACCESS_TOKEN = gcloud auth print-access-token --project=$exportProject
  if ($LASTEXITCODE -ne 0) { throw 'Authentication failed.' }
  node scripts/owner-export-readiness.cjs --project $exportProject
  if ($LASTEXITCODE -ne 0) { throw 'Owner export readiness failed.' }
} finally { $env:REMOTE_CONFIG_ACCESS_TOKEN = $priorExportToken }
```

The read-only check verifies the active function, runtime identity, enabled IAM
Credentials API, and supported self-scoped binding. A missing binding reports an
unsupported configuration; it does not prove that all effective signing access
is absent. An unreadable policy fails the check. Passing does not prove object
read access, absence of an IAM deny policy, or a working download. Complete an
authorized owner export download in the test browser and verify the file opens
without recording its contents or temporary signed URL.
