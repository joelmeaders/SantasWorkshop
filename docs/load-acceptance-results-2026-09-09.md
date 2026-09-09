# Historical load acceptance: September 9, 2026

## Result

**Blocked at the first hosted smoke signup. No load acceptance claim is made.**

The deployed email isolation gate passed. The normal reCAPTCHA Enterprise App Check exchange in the automated browser then returned HTTP 403, `PERMISSION_DENIED`, with `App attestation failed.` Signup reached the server without App Check and received HTTP 401. The runner stopped before calibration or sustained traffic.

This evidence establishes failure in the automated browser used for this run. It does not establish that every browser or real customer fails attestation. App Check enforcement was preserved. No authentication or cache workaround was applied.

## Revisions and validation

- Implementation: [PR #168](https://github.com/joelmeaders/SantasWorkshop/pull/168), merged as `89a5e730c5e5cb563ef7a35c33a0d89081fefc12`.
- Global Cloud Run inventory correction: [PR #169](https://github.com/joelmeaders/SantasWorkshop/pull/169), merged as `b2267b3b413b18d7c3ec86e24c4c927015af23a9`.
- Hosted run checkout: `b2267b3b413b18d7c3ec86e24c4c927015af23a9`, clean before execution.
- Functions source deployed from `89a5e73`; the later inventory correction changed only the local harness.
- PR #168 passed Functions unit validation, 36 Functions integration tests, 51 customer E2E tests, 83 staff E2E tests, customer/admin validation, and Storybook validation.
- PR #169 passed unit and combined integration/E2E checks. Both merges used the standing administrator review bypass after checks passed.
- [Test Functions deployment](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34308301006) passed. Its manual test-only selection reused the passed PR validation after identical Git trees were verified. The redundant automatic run was cancelled. Production deployment was skipped.
- [Test customer deployment](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34308235860) and [test admin deployment](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34308235832) passed.
- The harness-only merge's automatic deployment was cancelled before deployment; no cloud source changed.

## Email isolation evidence

All checks targeted `santas-workshop-test`.

- All 42 deployed Functions were active, configured for the sink, stripped of AWS configuration, and routed through the isolated VPC for all outbound traffic.
- Cloud Run service configuration, active revisions, global job inventory, triggers, queues, schedulers, private DNS, and effective firewall rules passed the gate.
- The v2 global Cloud Run listing reported unreachable regions. The corrected gate uses the complete v1 global ServiceList and reads each listed service's v2 configuration in its reported region. Partial lists or missing service identities still block.
- Latest function update: `2026-09-09T03:51:24.569917407Z`. The full 32-minute old-worker retirement window elapsed before testing.
- The private probe verified Google API connectivity and failed TCP connections to SES in `us-west-2` and `us-east-1` on port 443, and SMTP in `us-west-2` on ports 587 and 465. No email protocol payload or credentials were transmitted by the probe.
- Fresh full preflight passed in run `load-20260909T042337Z-8f69e918`. The traffic run repeated that gate before any fixture setup.
- Email isolation remains enabled. Simulated receipts are terminal and cannot replay as real delivery.

## Hosted attempt and recovery

Traffic run: `load-20260909T042402Z-cf17d028`, started at approximately `2026-09-09T04:24:02Z`.

| Measure                                      | Observed |
| -------------------------------------------- | -------: |
| Hosted smoke journeys attempted              |        1 |
| Hosted smoke journeys completed              |        0 |
| Auth accounts created                        |        0 |
| Registration records found                   |        0 |
| Completed registrations                      |        0 |
| Check-ins                                    |        0 |
| Pending email work for the attempted fixture |        0 |
| Run-owned slot reservations                  |        0 |

The deliberate missing-App-Check negative request was rejected in about 1.54 seconds. The first browser signup was also rejected without App Check. Read-only Auth lookup at `2026-09-09T04:29:49.310Z` confirmed no account for the attempted fixture. Read-only business-state recovery found no registration, check-in, or pending email work for it.

The initial browser recorder watched only direct Functions URLs. The hosted app uses same-origin Hosting rewrites, so that recorder missed the browser's HTTP 401. Server logs established the rejection. A separate read-only browser check captured the App Check exchange failure at `content-firebaseappcheck.googleapis.com`. The subsequent recorder correction includes Hosting rewrites, status, App Check presence, and failure screenshots.

The run-owned empty appointment slot and App Check debug-token registration are retained. No preexisting customer data was changed or deleted.

## Remaining acceptance and cost limits

All sustained signup, burst, staff, duplicate-protection, interruption/recovery, email-drain, and counter-reconciliation targets in [the load plan](load-acceptance.md) remain **unmeasured at the requested load**. No latency percentile or throughput acceptance result can be inferred from this stopped smoke attempt.

The preliminary conservative one-hour ceiling was **$17.73**, using all configured instance maxima, rounded-up compute rates, connector cost, and a $5 noncompute allowance. This is an estimate, not a billing export. Actual billed cost is unavailable. The retained connector continues to incur infrastructure cost.

The user subsequently narrowed execution to successful smoke tests only. The
follow-up smoke command uses the run-owned test App Check debug provider for the
automated browser while preserving backend enforcement. It must pass the full
isolation gate and all five journeys, then stop before calibration or load.
Normal reCAPTCHA Enterprise attestation remains a separate unverified result.

SES delivery and production acceptance remain unverified. Historical targets represent retained successful transactions plus headroom, not abandoned attempts, historical retries, or exact browser concurrency. Local evidence is retained under `artifacts/load/` and is excluded from Git.
