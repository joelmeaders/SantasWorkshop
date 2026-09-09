# Function memory and CPU validation

## Scope and method

Resource sizing is part of hosted test acceptance. A successful request alone
does not prove adequate memory, CPU, or concurrency capacity. The current
initial scope was smoke validation. A later full-load attempt stopped at its
instance guard and exposed another memory-headroom failure; see the
[full-load result](load-acceptance-full-results-2026-09-09.md).

The read-only collector in `scripts/load/resources.mjs` records each deployed
Function's memory, CPU, concurrency, maximum instances, and timeout. It joins
Cloud Run request counts, CPU/memory distributions, startup latency, request
latency, and concurrency distributions by current revision. It also checks
Cloud Logging for memory-limit terminations and request deadlines.

Percentiles and peaks are histogram upper bounds. Overflow is retained as
unknown, not converted to a made-up maximum. Missing samples remain missing,
not zero utilization. The smoke gate waits 180 seconds after its observation
window: metrics sample every 60 seconds and can take 120 seconds to arrive.
These timings come from the live metric descriptors and the
[Cloud Monitoring metric reference](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z).

For the functions exercised by a run, require:

- Request counts plus CPU and memory samples for the current revision.
- No out-of-memory termination, request deadline failure, or HTTP 5xx response.
- At least 20% observed memory headroom, using the peak histogram upper bound.
- CPU p95 at or below 80%, using its histogram upper bound.

The 20% headroom and 80% CPU thresholds are conservative test gates, not
provider guarantees or automatic scaling rules. The report marks unexercised
functions as unmeasured. Low-concurrency smoke data cannot validate a
function at its configured peak concurrency or prove production capacity.

## Baseline: September 9, 2026

Read-only evidence covered the current test revisions from 03:48 through
13:25 UTC. Nine of 42 Functions had observed requests. The other 33 did not
have workload coverage in this window.

| Function                      |  Memory |    CPU | Memory peak upper bound | CPU p95 upper bound | Finding                                   |
| ----------------------------- | ------: | -----: | ----------------------: | ------------------: | ----------------------------------------- |
| scheduledDateTimeSlotCounters | 128 MiB | 0.0833 |             99% sampled |                 31% | 152 memory-limit events; sizing fails     |
| newAccount                    | 512 MiB |      1 |                     36% |                  3% | Headroom at observed traffic              |
| saveDraftChild                | 256 MiB |      1 |                     74% |                  4% | Headroom at observed traffic              |
| setDraftAppointment           | 256 MiB |      1 |                     73% |                  2% | Headroom at observed traffic              |
| completeRegistration          | 256 MiB |      1 |                     74% |                  4% | Headroom at observed traffic              |
| sendNewRegistrationEmails     | 256 MiB |      1 |                     69% |                  4% | Headroom with simulated delivery          |
| publicParametersGateway       | 256 MiB |      1 |                     66% |                  3% | Headroom at observed traffic              |
| scheduledRegistrationStats    | 256 MiB | 0.1666 |                     65% |                  5% | One observed invocation; limited coverage |
| emailIsolationProbe           | 256 MiB |      1 |                     59% |                  1% | Probe coverage only                       |

The counter's memory sampling did not capture every failing peak. Logs proved
that it crossed the limit, including 134 and 147 MiB used against 128 MiB.
The resource gate fails from those logs even when sampled utilization is lower.
The same revision returned 3 HTTP 200, 96 HTTP 500, and 15 HTTP 503 responses
in the baseline window. Startup/health retries mean these counts do not equal
the number of memory-limit log events.

## Counter correction

Raised `scheduledDateTimeSlotCounters` from 128 MiB to 256 MiB. Retained
`cpu: 'gcf_gen1'`, concurrency one, maximum one instance, and the existing
timeout. With Firebase's fractional CPU mapping, this also increases CPU
from approximately 1/12 to 1/6. The change addresses the measured memory
failure without adding concurrency or warm instances.

Do not reduce the customer Functions to fractional CPUs because their
sequential smoke CPU usage is low. Firebase requires at least one full CPU
for concurrent requests. Those Functions retain their one-CPU configuration
until representative concurrency evidence supports another setting.
See [Firebase runtime and CPU configuration](https://firebase.google.com/docs/functions/manage-functions#override_cpu_defaults).

Only the test project was deployed for this validation. The source change
can reach production only through a later authorized production release.
The new revision passed repeated scheduled requests. During the later partial
load run it reconciled 236 completed registrations, with memory bounded at 62%
and CPU p95 at 4%. The user chose to skip another smoke run and start full load.
That run found `completeRegistration` at an 81% memory bound and `saveDraftChild`
at 80%; it did not establish full capacity. Normal reCAPTCHA attestation and real
SES delivery remain separate from debug-provider and sink evidence.

## Follow-up configuration in the PR

The partial load evidence supports increasing `completeRegistration` from
256 to 512 MiB. It keeps one CPU, concurrency 20, and a maximum of ten instances.
`publicParametersGateway` increases its maximum from one to two instances while
keeping 256 MiB, one CPU, concurrency 80, and zero minimum instances. Its live
deployment checks require the matching two-instance limit. The Remote Config
budget remains 60 reads/minute: 24 for four overlapping gateway instances during
replacement, leaving 36 for cold starts and operations.

These follow-up settings are source changes for review. They have not been
deployed or load-tested. No additional hosted load run was performed after the
user requested documentation and the PR. `saveDraftChild` remains at 256 MiB
because its measured 80% bound met the current headroom gate; it has no spare
margin beyond that gate. No CPU change is supported by the measured usage.

The commands and operating instructions now live in
[`scripts/load/README.md`](../scripts/load/README.md).

## Reusable read-only command

```text
node scripts/load/resources.mjs --project santas-workshop-test --start <UTC-start> --end <UTC-end> --functions scheduledDateTimeSlotCounters,newAccount,saveDraftChild,completeRegistration --output artifacts/load/resources.json
```

Use an observation window no longer than 24 hours and allow three minutes
after its end for metrics to settle. Omitting `--functions` produces an
inventory report, not an acceptance decision. `smoke` and `run` select their
required functions from the completed journeys and include the email worker,
public-parameters gateway, and scheduled counter when applicable.
