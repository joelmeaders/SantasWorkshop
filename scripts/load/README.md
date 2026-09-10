# Hosted load tests

Load infrastructure is optional and is not required for normal PR validation.
Normal test deployments use AWS SES, omit the isolation probe, clear VPC
connector settings, and use the ordinary seasonal counter schedule. Keep the
load connector deleted between campaigns; it has an ongoing minimum-instance
charge. Provisioning and retirement scripts require the explicit test project.

Run these commands from the repository root with Node 24 and pnpm. This harness
targets **`santas-workshop-test` only**. It creates labeled QA accounts and test
records through deployed customer and staff APIs. It does not use emulator
cleanup helpers or delete its fixtures.

The workload uses the historical peaks plus the selected 50% headroom. See the
[test plan](acceptance.md) for the workload and acceptance
criteria. Create dated run reports directly in the Obsidian project's
`Archive/Load and Resources` folder, following the
[recording policy](../../docs/README.md#recording-future-work). The vault's
Archive Index links prior attempts and their source evidence. A report applies
only to its recorded revision and workload; source changes require fresh
deployment and load evidence before acceptance.

## Prepare the environment

1. Install dependencies with `pnpm install`. Use a clean, committed worktree so
   the journal can identify the exact harness version. A full run rejects a
   dirty worktree and always generates a fresh run ID.
2. Sign in to the intended Google account with the gcloud CLI. The harness uses
   that account for test-project inventory and run-owned fixture setup. Customer
   calls use ordinary Firebase password authentication and App Check.
   The email-control commands also require Application Default Credentials or
   `REMOTE_CONFIG_ACCESS_TOKEN`; see [email control authentication](../../docs/SECRETS_AND_CONFIGURATION.md#remote-email-sending-control).
3. Disable email with `node scripts/email-sending.cjs disable --project
santas-workshop-test`. This is an application stop control, not proof of AWS
   network isolation. Never send load while ordinary SES transport is active.
4. Provision the network before deploying isolated Functions. This creates the
   `load-email-isolation` custom IPv4 subnet (`10.253.0.0/28`), Google-only
   egress rules, three private DNS zones, and the `load-email` connector in
   `us-central1` (two to three `e2-micro` instances, no NAT or peering):

```text
node scripts/load/provision-network.mjs --project santas-workshop-test --apply
```

5. Dispatch the reviewed Functions workflow with **test** as the deployment
   target, the exact committed ref, and `load_test_mode=true`. For example:

```text
gh workflow run functions-test-and-prod-release.yml --ref <reviewed-branch> -f release_ref=<commit-sha> -f deployment_target=test -f load_test_mode=true -f skip_tests=false
```

The workflow passes `SANTASHOP_LOAD_TEST_MODE=true` to the generator. This
test-only opt-in removes AWS credentials, routes all Function egress through
the connector, deploys the private probe, and sets counters to run every five
minutes. A normal push or dispatch defaults to `false`; coordinate other test
deployments so they cannot restore ordinary SES while a campaign is active.
Do not pass load mode to production. Do not replace CI deployment with a local
Functions deploy.

6. Wait for deployment success and the retirement window below. Review the
   current worker inventory and queued work. Enable the email control for
   **sink processing** only after all deployed senders have no AWS credentials
   and use the verified deny network. Allow three minutes for caches:

```text
node scripts/email-sending.cjs enable --project santas-workshop-test
```

7. The test public settings must permit signup, registration, check-in, and
   on-site registration. Review them through owner App settings. Run preflight
   before traffic. It checks the email control and independent network/runtime
   isolation; the control alone never authorizes load.

After any Functions deployment, wait at least 32 minutes for previous work to
retire. Preflight checks the live configuration, network restrictions, worker
inventory, and a TCP-only negative SES/SMTP probe before any account is created.
It fails closed if evidence is missing or a previous revision has not retired.

## Retire the environment after a campaign

1. Stop the load generator and wait for its in-flight work to finish. Disable
   the email control and allow three minutes for sender caches. Review Cloud
   Tasks, the Eventarc subscription backlog, and registration email records.
   Resolve queued, failed, or in-flight synthetic work before restoring SES.
   Simulated and suppressed queue records are terminal; retain that state so
   old work cannot be replayed. Archive selected evidence under the recording
   policy before any separately authorized fixture cleanup.
2. Dispatch the same reviewed Functions workflow with
   `deployment_target=test` and **`load_test_mode=false`**. Keep email disabled.
   The deploy uses the scoped `TEST_AWS_ACCESS_KEY_ID` and
   `TEST_AWS_SECRET_ACCESS_KEY` repository secrets, explicitly clears connector
   routing, removes the probe, and restores the normal counter schedule.
3. Verify all Functions are ACTIVE, Cloud Run has completed the deployment,
   and current services no longer reference the connector. Retire the network:

```text
node scripts/load/retire-network.mjs --project santas-workshop-test --apply
```

The script removes non-serving isolated revisions, then the connector, private
DNS records/zones, firewall rules, subnet, and VPC. It refuses attached active
services, unexpected jobs, VMs, and peering. It never deletes application data,
current serving revisions, other networks, or production resources. Recheck
the reported operation after a timeout before retrying. No automatic expiry
is configured; the operator must complete this step to stop connector charges.

4. Verify no connector, isolation network, DNS zones, or isolation probe
   remains. Compare published application email templates with AWS SES:
   publishing in sink mode writes only the local revision. Review and publish
   any intended missing revisions before resuming ordinary email.
5. Re-enable the email control only when normal credentials, runtime access
   to Remote Config, template mappings, and queue disposition are verified.
   Re-enabling does not replay suppressed or simulated records. Use a new,
   explicitly authorized QA message for inbox validation; this procedure does
   not send one automatically.

## Choose a command

These commands include the required project argument. They never target
production. Preflight performs inventory and isolation checks without seeding
accounts. Smoke and full runs perform their own fresh preflight as well.

```text
node scripts/load/run.mjs preflight --project santas-workshop-test
node scripts/load/run.mjs smoke --project santas-workshop-test
node scripts/load/run.mjs run --project santas-workshop-test
```

`smoke` performs five hosted browser signup journeys, including three children,
appointment selection, completion, QR rendering, and business/resource checks.
It stops before calibration. Its browser dependency is Playwright Chromium;
install it with `pnpm --filter @santashop/e2e exec playwright install chromium`
if needed.

`run` performs smoke and then the full workload:

| Phase              | Traffic                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| Calibration        | 24 signups in two minutes                                              |
| Sustained signup   | 1,080 signups in 15 minutes                                            |
| Signup bursts      | Three rounds of 135 in one minute, with two-minute drains              |
| Completion cluster | Nine prepared registrations completed in one second                    |
| Staff              | 243 check-ins over 15 minutes, across ten authenticated staff sessions |
| Staff bursts       | 23 in one minute, then five in one second                              |
| Duplicate handling | Ten concurrent scans of one fixture                                    |
| Recovery           | Interrupt a completion request and retry the same mutation ID          |

When the operator explicitly chooses to reuse prior browser validation, omit
the browser phase with:

```text
node scripts/load/run.mjs run --project santas-workshop-test --skip-smoke
```

This starts with calibration and records `smokeSkipped` in the manifest. It
retains isolation, App Check, monitoring, budget, business, latency, and resource
gates. The flag is invalid with `smoke`, `preflight`, or `verify`.

Do not pass `--run-id` to a new run. Accounts, appointments, and staff identities
must belong to a fresh run. Use an existing ID only for read-only verification.

## Monitor and stop

The process prints its evidence directory when it exits. While it runs, inspect
the newest `artifacts/load/load-*/events.jsonl` file. The journal records phase
starts/ends, requests, isolation checks, instance samples, cost ceilings, stops,
and verification results. It includes QA emails and UIDs; keep it local.
Passwords, App Check secrets, and QR download tokens stay out of the journal.

Isolation and the deployed revision fingerprint are checked every minute. New
calls stop if the proof expires, revisions change, unexpected errors exceed 1%
in a rolling minute, or a service remains at its instance ceiling for five
minutes. The single-instance isolation probe is excluded from the instance
check. The shared settings gateway is included because customer Functions call
it indirectly. Reaching an instance ceiling is a conservative stop condition,
not proof that its CPU or concurrency is exhausted.

The budget is $25, with arrivals stopped at a conservative $20 ceiling and $5
reserved for drain. Calibration checks a one-hour cost projection before main
load. Estimates use configured maximum instances, rounded compute rates, and a
fixed allowance; they are not billed costs. The retained network connector can
continue to incur costs after the test.

Use Ctrl+C to stop arrivals. Allow in-flight work and read-only verification to
finish. Do not restore real email delivery while generated work may still run.
The traffic runner does not clean up fixtures or restore SES automatically.
Follow the retirement procedure above.

## Read and verify results

Each run writes `summary.json` and `events.jsonl`. A normal completed acceptance
path also collects `resources.json`. Browser smoke adds screenshots. A stopped
run can leave some gates unexecuted; a null result is not a pass.

Recheck a stopped run's business records without starting traffic:

```text
node scripts/load/run.mjs verify --project santas-workshop-test --run-id <run-id>
```

This verifies the existing manifest and records, including duplicates, children,
QR data, check-ins, slot counts, and simulated email receipts. It writes
`verification.json`. It does not resume load or rerun resource acceptance.

For a separate read-only resource report, use UTC timestamps covering the run
and an existing output directory:

```text
node scripts/load/resources.mjs --project santas-workshop-test --start <UTC-start> --end <UTC-end> --functions newAccount,saveDraftChild,setDraftAppointment,completeRegistration,sendNewRegistrationEmails,scheduledDateTimeSlotCounters,publicParametersGateway --output artifacts/load/resources.json
```

Use a window of at most 24 hours. Round its end up to the next minute to include
the final partial sample, then wait three minutes for sampling and ingestion.
The report joins current revisions and records memory, CPU, requests, latency,
concurrency, and memory/deadline failures. Required functions must have samples,
no OOM/deadline/HTTP 5xx failures, at least 20% memory headroom, and CPU p95 at or
below 80%. Histogram values are upper bounds. Missing data is not zero usage.
Omitting `--functions` creates an inventory with no acceptance decision.

Keep a post-stop resource report separate from the original stop result. Do not
replace a failed or unexecuted gate with a pass merely because records later
reconcile. Normal reCAPTCHA attestation, real SES delivery, production readiness,
and unexecuted workload phases require their own evidence.

## Local checks and implementation

```text
pnpm run load:test
```

This runs local unit tests for the harness; it does not send hosted load.

| File                                                           | Responsibility                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `run.mjs`                                                      | Phase orchestration and run manifest                                 |
| `config.mjs`                                                   | Project guards, fixture shapes, and traffic targets                  |
| `isolation.mjs`, `provision-network.mjs`, `retire-network.mjs` | Isolation checks, network setup, and retirement                      |
| `configuration.cjs`, `functions/`                              | Optional deployment configuration, hash-only sink, and private probe |
| `acceptance.md`, `resource-sizing.md`                          | Workload, acceptance criteria, and resource measurement              |
| `browser-smoke.mjs`, `customer.mjs`                            | Browser journeys and authenticated API journeys                      |
| `metrics.mjs`, `monitor.mjs`                                   | Journal, arrivals, stop conditions, cost and instance checks         |
| `verify.mjs`                                                   | Read-only business reconciliation                                    |
| `resources.mjs`                                                | Read-only memory and CPU acceptance                                  |

Update the targets or stop conditions only as an explicit test-plan change.
Commit changes before a hosted run and retain earlier failed evidence.

