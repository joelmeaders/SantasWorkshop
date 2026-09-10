# Hosted load acceptance

For setup, commands, monitoring, stopping, and result verification, start with
[`scripts/load/README.md`](README.md).

This harness targets only `santas-workshop-test`. Run it from the workspace root
with Node 24 and the existing pnpm dependencies. It never deletes fixtures and
does not call emulator helpers. Keep `artifacts/load/` local: it contains labeled
QA account addresses, UIDs, and browser screenshots. Passwords and tokens stay
in process memory and are not written to the journal.

## Configured workload

The workload below is defined in [`scripts/load/config.mjs`](config.mjs).
Review the targets against retained traffic and an agreed headroom allowance
before each acceptance campaign. Store the dated research and rationale with
the campaign record in the project vault. The configured targets are inputs,
not proof of accepted capacity.

| Phase                | Offered traffic                                              |
| -------------------- | ------------------------------------------------------------ |
| Hosted browser smoke | Five full UI journeys                                        |
| Calibration          | 24 signups in two minutes                                    |
| Sustained signup     | 1,080 signups in 15 minutes                                  |
| Signup bursts        | Three rounds of 135 in one minute, with two-minute drains    |
| Completion cluster   | Nine prepared registrations in one second                    |
| Sustained staff      | 243 check-ins in 15 minutes across ten staff sessions        |
| Staff bursts         | 23 in one minute, then five in one second                    |
| Duplicate scans      | Ten concurrent scans of one unused fixture                   |
| Recovery             | Interrupt one completion request; retry the same mutation ID |

Each synthetic customer has three children.
The staff mix uses every eleventh journey for on-site registration and the next
for a child edit, approximately 9% each. Registration records created through
the preceding signup phases supply the ordinary check-in fixtures.

Retained successful transactions do not reconstruct abandoned attempts,
cancellations, retries, or device counts. Keep those limits with any sizing analysis.

## Email isolation comes first

When `SANTASHOP_LOAD_TEST_MODE=true`, the test configuration generator omits all
AWS credentials and forces the `sink` transport. Normal test deployments use
SES. Production cannot use load mode. All isolated test Functions
route all egress through the dedicated `load-email` VPC connector. Network
rules allow only the Private Google Access VIP over TCP 443 and the connector's
required infrastructure protocols; higher-priority IPv4 and IPv6 denies block
other egress. There is no NAT or peering. Private DNS resolves Google APIs and
Google service domains to the private VIP.

Inventory includes all deployed Functions, Cloud Run services and jobs,
schedulers, Cloud Tasks queues, and Eventarc destinations. Additional workers,
secret mounts, proxies, credentials, tagged/old traffic, unreviewed firewall
policies, and inaccessible inventories block execution. After deployment, wait
at least 32 minutes so previous invocations can finish. The IAM-private
`emailIsolationProbe` checks Google connectivity and makes TCP-only connection
attempts to SES and SMTP endpoints. It performs no TLS, authentication, email
API request, or SMTP command, so the probe cannot deliver an email if isolation
fails. A successful negative probe supplements the network and runtime checks.

Email paths covered by the source changes:

| Path                                  | Sink behavior                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `sendRegistrationEmail` queue trigger | Resolve published revision, render locally, record hash-only receipt, mark queue `simulated` |
| Reminder and retry queue work         | Uses the same trigger; simulated queue items are terminal, including after transport changes |
| `requestPasswordReset`                | Render the reset email and record a simulated receipt                                        |
| `callableSendTestEmailTemplate`       | Render the requested template and record a simulated receipt                                 |
| `callablePublishEmailTemplate`        | Publish local revision without an AWS template API call                                      |

Receipts never claim SES acceptance or recipient delivery. Keep network denial
and credential removal active while any generated email work remains. Do not
restore SES merely because arrivals stopped. This harness has no restore or
fixture-cleanup command. Follow the [retirement procedure](README.md#retire-the-environment-after-a-campaign)
to restore normal deployment and remove the connector, which has continuing
infrastructure cost while retained.

## Commands

```text
node scripts/load/provision-network.mjs --project santas-workshop-test --apply
pnpm run load:preflight --project santas-workshop-test
node scripts/load/run.mjs smoke --project santas-workshop-test
pnpm run load:run --project santas-workshop-test
node scripts/load/run.mjs run --project santas-workshop-test --skip-smoke
pnpm run load:verify --project santas-workshop-test --run-id <printed-run-id>
```

Functions deploy through the existing CI release workflow. Do not bypass its
deployment guard. Test counter reconciliation must run every five minutes
during the test; the preflight requires `*/5 * * * *`. The deployed public
settings must allow customer and staff journeys. Preflight does not toggle
public settings. It discovers the customer Web App configuration from Firebase
and checks project, bucket, and hosted origins before any fixture write.

Browser smoke uses ordinary hosted sign-up, terms acceptance for labeled QA
accounts, child forms, appointment selection, completion, and QR rendering.
The `smoke` command stops after five successful browser journeys and business,
email-sink, and counter verification. It does not start calibration or load.
For an explicitly requested full run after prior browser validation, use
`run --skip-smoke` to start with calibration. The run manifest records the
omitted smoke phase. Isolation, App Check, budget, monitoring, business, and
resource gates still apply; all load phases use fresh run-owned fixtures.
Automated browsers and synthetic phases use normal password authentication and
real App Check tokens exchanged through a run-owned test debug-provider registration.
They do not substitute privileged tokens for customer requests. The debug
registration is recorded by resource name; its secret is not recorded.
Backend App Check enforcement remains active. This tests attested application
requests but does not validate normal reCAPTCHA Enterprise browser attestation.

Arrival timing is open loop. Slow responses do not silently reduce offered
traffic. A generator delay above 250 ms or 100 outstanding journeys stops the
phase. Ten staff tokens distribute the total workload; the count is not per
staff member. Account and on-site creation are never automatically retried.
The durable journal records intent before mutations so interrupted work can be
found by its unique email address. `verify` performs only reads, does not resume
traffic, and can run after a crash without the original passwords.

## Acceptance and operating budget

Report attempted and completed journeys separately. Record every operation's
p50/p95/p99 and fraction below two seconds by phase. Unexpected errors fail
acceptance; expected duplicate rejections and the intentional client abort are
recorded separately. Stop on a rolling-minute unexpected error rate above 1%,
isolation failure/expiry, revision drift, generator mismatch, invalid business
state, or five minutes of active application instances at a configured ceiling.
Idle warm instances and the harness's private TCP probe are excluded from that
saturation check. Cloud Monitoring
evidence must be available and fresh. Isolation is rechecked every minute; an
expired proof stops new client calls.

Smoke and full-run verification also check deployed memory and CPU. After
business verification, the harness waits three minutes for the 60-second
monitoring samples and up to 120 seconds of ingestion delay. It writes
`resources.json` for the exact deployed revisions. Required functions must
have request, memory, and CPU evidence, no memory-limit termination or HTTP
5xx response, at least 20% observed memory headroom, and CPU p95 at or below
80%. These are observed-workload checks, not proof of capacity at configured
maximum concurrency. Unexercised functions remain explicitly unmeasured.
See [function resource sizing](resource-sizing.md) for methods,
limits, and resource-change validation.

After calibration, the conservative cost projection must be below $20 before
main load starts. Compute estimates charge every configured maximum instance
for the full elapsed/projected time, with no free tier and rounded-up CPU and
memory rates. A $5 allowance covers other services; this is an estimate, not
an invoice or guaranteed billing cap. Actual billed cost remains unknown until
billing data is available. The $25 budget reserves $5 for verification.
See [Cloud Run pricing](https://cloud.google.com/run/pricing) and
[connector pricing](https://cloud.google.com/vpc/pricing).

Verification checks registration uniqueness, children, QR ownership and index,
check-ins, returned coupon counts, retained edits and original check-in times,
simulated queue receipts, and the run-owned appointment counter. Soft
overbooking is allowed. Keep generated fixtures for review. Create narrative run
reports directly in the Obsidian project's `Archive/Load and Resources` folder.
Follow the [recording policy](../../docs/README.md#recording-future-work) for the exact path
and for archiving selected evidence from generated local output directories.
The journal includes UTC timestamps, deployed revisions, instance evidence,
cost estimates, operation results, and any stop reason. A code test, build,
deployment, or preflight pass alone is not a load acceptance pass. SES delivery
and production acceptance remain explicitly unverified.
