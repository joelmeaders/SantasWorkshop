# Hosted load tests

Run these commands from the repository root with Node 24 and pnpm. This harness
targets **`santas-workshop-test` only**. It creates labeled QA accounts and test
records through deployed customer and staff APIs. It does not use emulator
cleanup helpers or delete its fixtures.

The workload uses the historical peaks plus the selected 50% headroom. See the
[test plan](../../docs/load-acceptance.md) for the workload and acceptance
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
3. Deploy the reviewed Functions configuration through the repository's CI
   release workflow. The harness does not deploy Functions or change public
   feature flags. The test settings must permit signup, registration, check-in,
   and on-site registration. The counter schedule must be `*/5 * * * *`.
4. Ensure test email isolation has been provisioned: sink transport, no AWS
   credentials, restricted VPC egress, private Google API DNS, and no unreviewed
   workers. The one-time infrastructure command below changes the test network;
   use it only as part of authorized environment setup. Reuse an existing setup.

```text
node scripts/load/provision-network.mjs --project santas-workshop-test --apply
```

After any Functions deployment, wait at least 32 minutes for previous work to
retire. Preflight checks the live configuration, network restrictions, worker
inventory, and a TCP-only negative SES/SMTP probe before any account is created.
It fails closed if evidence is missing or a previous revision has not retired.

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
The harness has no cleanup or restore command.

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

| File                                     | Responsibility                                               |
| ---------------------------------------- | ------------------------------------------------------------ |
| `run.mjs`                                | Phase orchestration and run manifest                         |
| `config.mjs`                             | Project guards, fixture shapes, and traffic targets          |
| `isolation.mjs`, `provision-network.mjs` | Live isolation checks and authorized network setup           |
| `browser-smoke.mjs`, `customer.mjs`      | Browser journeys and authenticated API journeys              |
| `metrics.mjs`, `monitor.mjs`             | Journal, arrivals, stop conditions, cost and instance checks |
| `verify.mjs`                             | Read-only business reconciliation                            |
| `resources.mjs`                          | Read-only memory and CPU acceptance                          |

Update the targets or stop conditions only as an explicit test-plan change.
Commit changes before a hosted run and retain earlier failed evidence.
