# Follow-up issue resolution

Started September 7, 2026, after PR #161 merged. This report supplements
[the deployed QA report](remote-config-deployed-qa.md). Earlier observations
remain historical evidence, not claims about later fixes.

## Verified configuration repair

The ignored local `.env` production Firebase API key differed from production.
The replacement was read from the production Hosting initialization endpoint.
The project was verified as `santas-workshop-193b5`, and the key also matched
the currently loaded production JavaScript bundle. Only
`PROD_FIREBASE_API_KEY` changed. A fresh file read verified the replacement.
No key value is included here. No cloud configuration or GitHub secret changed.

## Inbox delivery verified

The connected Gmail profile matched the approved QA mailbox. These messages
were read from that inbox on September 7, 2026. All three had SPF, DKIM and
DMARC pass results in their authentication headers.

| QA message             | Receipt time (UTC) | Evidence                         |
| ---------------------- | ------------------ | -------------------------------- |
| Registration ticket    | 19:03:47           | Gmail message `1a07d4153d9c7106` |
| QA RC template preview | 20:16:33           | Gmail message `1a07d83f1dd61caa` |
| Spanish cancellation   | 20:24:38           | Gmail message `1a07d8b556b59c68` |

The recipient was the run's approved `qarc0907c` mailbox alias. Ticket and
preview messages contained both plain-text and HTML MIME parts. This closes
the inbox-delivery gap for those operations. It does not prove password-reset
completion or delivery to other recipients. No new messages were sent during
this verification.

## Signup recovery

If account creation succeeds but the following sign-in fails, the customer now
gets Sign In and Reset Password actions. The application does not repeat account
creation. A rejected verification request gets neutral retry-later guidance,
with the entered form data retained. Both supported languages contain the new
messages. App Check remains enabled.

Navigation is awaited separately from authentication. A failed route transition
uses the normal error handler and does not suggest resetting a valid password.
The focused signup suite passed 18 tests. Changed-file ESLint and the diff check
passed. These are local checks; they do not establish the cause of the earlier
in-app browser failure. The existence of the `qa0907v` account remains unverified.

## Gateway validation

The release gate now checks the same gateway hostname pattern as the consumer
client. Before this change, readiness could accept another Cloud Run service
that the consumer would reject. This aligns the checks with the current runtime;
it does not add support for other Cloud Run hostname formats.

Deterministic tests cover 80 simultaneous cold reads, replacement-instance
caches, retry boundaries, cold failure recovery, and HTTP 200/405/503 behavior.
The Functions unit suite passed 433 tests across 68 files. The focused gateway
run passed 36 tests across three files, and Functions lint passed.

These tests use mocked upstream fetches. They establish local single-flight and
backoff behavior, not Cloud Run capacity, actual revision overlap, production
network latency, or quota headroom under repeated instance replacement.

## Settings delivery

Scheduled watchdog fetches and stream-error fallback fetches now bypass the
SDK minimum fetch interval for that request. The previous interval is restored
after success or failure. This removes the extra cache window that could make
a one-minute watchdog require a second minute. Manual, focus and online refresh
requests keep their existing limit. Concurrent refreshes still share one request.

Core validation passed 175 tests across 22 files, the core build, changed-file
ESLint, and the diff check. Tests cover watchdog and fallback cache bypass and
SDK interval restoration.

Delivery still depends on the timer and network time. Hidden tabs pause timers,
and repeated failures keep the existing backoff. The ten-second delivery target
remains unmet by the earlier live evidence and is not established by these tests.

Physical camera decoding and authenticated production journeys remain outside
the evidence collected here. Production customer data remains unchanged.

## Release and deployed checks

[PR #162](https://github.com/joelmeaders/SantasWorkshop/pull/162) merged as
`788687be63d1b40c7238f87f5e283c4f8fb0ab5a` after all five PR checks passed.
CI included 50 customer and 83 admin emulator browser tests. The admin merge
bypassed the review requirement, as authorized; it did not bypass failed tests.

| Target     | Customer                                                                         | Admin                                                                            | Functions                                                                        |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Test       | [Passed](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34171791185) | [Passed](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34171793516) | [Passed](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34171795371) |
| Production | [Passed](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34172316134) | [Passed](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34172318161) | Runtime source unchanged; not redeployed                                         |

These manual deployments used the approved `skip_tests=true` option after PR
validation. Build and deployment checks still ran. Superseded automatic test
deployment runs were cancelled to avoid duplicate deployments.

The test customer session survived the normal update prompt. Its visible tab
made a Remote Config HTTP 200 request 60.965 seconds after reload. The next two
HTTP 200 responses were 60.021 and 60.032 seconds apart. This verifies the
deployed watchdog cadence, not publication-to-display latency.

The existing Chrome admin session briefly showed an empty route after its
update. A second ordinary reload recovered the owner menu. App Check, token,
account lookup, Remote Config and bundle responses then returned HTTP 200.
The separate in-app browser staff session updated and retained its expected
check-in-only menu. No application console errors were observed. The first
blank startup's network trace was not captured, so its cause remains unproved.
Source review places the root-route wait in authentication before Remote Config
initialization. Treat this as an intermittent startup observation, not a fixed
or conclusively diagnosed defect.

Production customer and admin pages were inspected after deployment. Their
normal update prompts reloaded successfully. The customer maintenance notice
and closed-signup state remained visible. Admin sign-in rendered with version
`2026.09.0-beta.3`. Startup warning/error logs were empty. These production checks
were read-only and did not exercise authenticated customer journeys.
