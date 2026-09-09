# Hosted smoke results: September 9, 2026

## Result and scope

**Five of five hosted browser smoke journeys passed. Testing stopped before calibration or load, as requested.**

The subsequent read-only checks confirmed the five completed registrations, 15 children, QR ownership/search state, and five terminal simulated email receipts. The scheduled slot counter did not reconcile: its Function failed with an out-of-memory error. Overall load acceptance is therefore **not established**.

No more browser journeys, calibration, signup bursts, staff traffic, or full load will run under this completed smoke-only execution.

## Verified smoke evidence

Run: `load-20260909T043941Z-3043942b` in `santas-workshop-test`.

- Clean runner commit: `744e0919fd8b4af6759acac4ef2738c558c08120`.
- Started: `2026-09-09T04:39:41.867Z`.
- Fifth browser journey completed: `2026-09-09T04:41:39.533Z`.
- Five normal customer Auth accounts and five completed registrations were verified by read-only lookup.
- Each journey used the hosted signup form, QA terms acceptance, three child forms, appointment selection, review, submission, and visible QR confirmation.
- All 30 browser callable requests succeeded and carried App Check. All were under two seconds; the slowest was 1,958.924 ms.
- All five simulated email receipts drained within 3,439 ms. No SES delivery acceptance was recorded.
- Three live isolation checks passed during the run.
- No calibration or load phase events occurred.

| Browser callable      | Responses |        p50 |    p95 / p99 |
| --------------------- | --------: | ---------: | -----------: |
| Account creation      |         5 | 737.587 ms |   967.900 ms |
| Save child            |        15 | 248.816 ms |   372.383 ms |
| Select appointment    |         5 | 309.980 ms |   460.203 ms |
| Complete registration |         5 | 359.389 ms | 1,958.924 ms |

These are small-sample smoke measurements, not a throughput or sustained-load acceptance result.

## App Check and harness corrections

The normal reCAPTCHA Enterprise App Check exchange in the automated browser returned HTTP 403, `PERMISSION_DENIED`, with `App attestation failed.` The backend correctly rejected signup without App Check. That first attempt created no Auth account or registration.

The successful automated smoke used a run-owned, registered test App Check debug provider. Backend enforcement remained active, and a deliberate missing-App-Check request was rejected. This validates attested application requests; **normal reCAPTCHA Enterprise browser attestation remains unverified**.

Live evidence also exposed three harness issues that were corrected:

- Hosted Functions calls use same-origin Hosting rewrites. The recorder now captures those routes as well as direct Functions URLs, HTTP status, and App Check presence, and saves failure screenshots.
- The reused submission helper checked for the review action before hosted data finished loading. Smoke now waits for the visible review action. That earlier attempt left one retained QA draft account with three children.
- Recovery searched for mixed-case fixture emails, while the app stores lowercase emails. The corrected read-only lookup found all five completed registrations. The original verifier stop remains in the journal; it did not represent a failed browser journey.

## Unresolved counter finding

The run-owned slot still had zero reservations when five were expected. Cloud logs show `scheduledDateTimeSlotCounters` exceeded its 128 MiB limit:

- `2026-09-09T04:40:03.246346Z`: 147 MiB used; HTTP 500.
- `2026-09-09T04:45:03.252235Z`: 134 MiB used; HTTP 500.

The scheduler remained enabled on its five-minute cadence. No manual counter write or memory/configuration change was made to hide or remediate this finding after the requested browser smoke stop. Counter reconciliation and full acceptance remain unresolved.

## Deployment and isolation

- [PR #168](https://github.com/joelmeaders/SantasWorkshop/pull/168) deployed the isolation and load harness implementation from `89a5e730c5e5cb563ef7a35c33a0d89081fefc12`.
- [PR #169](https://github.com/joelmeaders/SantasWorkshop/pull/169) corrected global Cloud Run discovery without changing cloud source.
- [PR #170](https://github.com/joelmeaders/SantasWorkshop/pull/170) contains smoke-only execution, the evidence-driven harness corrections, and this report.
- PR #168 passed unit checks, 36 Functions integration tests, 51 customer E2E tests, 83 staff E2E tests, customer/admin validation, and Storybook validation. PR #169 passed its unit and integration/E2E checks.
- [Test Functions deployment](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34308301006), [test customer deployment](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34308235860), and [test admin deployment](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34308235832) passed.
- The manual test Functions deployment reused passed PR checks after identical Git trees were verified. Redundant automatic deployments were cancelled. Production deployment was skipped.
- Administrator merges used the standing review bypass after checks passed. No branch protection was changed.

All 42 deployed Functions passed checks for sink mode, removed AWS configuration, and all-traffic VPC routing. Service revisions, global jobs, triggers, queues, schedulers, private DNS, and effective firewalls passed inventory checks. Partial global Cloud Run lists are rejected; the harness uses the complete v1 ServiceList plus per-service v2 configuration reads.

The latest Function update was `2026-09-09T03:51:24.569917407Z`. The full 32-minute old-worker retirement window elapsed before any smoke account was created. Fresh preflight `load-20260909T042337Z-8f69e918` passed.

The private safe probe confirmed Google API connectivity and blocked SES TCP connections in us-west-2/us-east-1 on port 443 and SMTP in us-west-2 on ports 587/465. It transmitted no email payload or credentials. Isolation remains enabled, and simulated email receipts are terminal so they cannot replay as real delivery.

## Retained state and limits

The successful run's five completed QA accounts are retained, along with the earlier incomplete QA draft, run-owned appointment slots, and App Check debug registrations. No preexisting customer data was changed or deleted. Local screenshots, journals, monitoring, and read-only verification evidence remain under `artifacts/load/`, excluded from Git.

The successful smoke's final conservative cost ceiling was **$5.46**, including a $5 noncompute allowance. This is not a billing export and does not state actual cost across earlier attempts. Actual billing is unavailable. The retained connector continues to incur infrastructure cost.

The sustained signup, burst, staff, duplicate-protection, request-interruption, and full-load reconciliation targets in [the load plan](load-acceptance.md) were not run. SES delivery and production acceptance remain unverified. Historical targets describe retained successful transactions plus headroom, not abandoned attempts, historical retries, or exact browser concurrency.
