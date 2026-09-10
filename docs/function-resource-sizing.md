# Function memory and CPU validation

## Scope and method

Resource sizing is part of hosted test acceptance. A successful request alone
does not prove adequate memory, CPU, or concurrency capacity. Choose the workload
explicitly for each run. Smoke measurements do not establish sustained-load capacity.

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

## Choosing and validating a resource change

Use the source runtime profiles in `santashop-functions/src/index.ts` and the
deployed revision inventory as the starting point. Change memory, CPU,
concurrency, or instance limits only when measurements support the change.
Keep the measured workload, failure evidence, old and new settings, and
post-deployment results in the project vault's release record.

Create each dated measurement report directly in the vault's
`Archive/Load and Resources` folder using the [recording policy](README.md#recording-future-work).
Keep source profiles in the [release procedure](release-readiness.md#function-resource-profiles)
and the gateway's cache, instance limits, and read budget in the
[Remote Config guide](remote-config.md). Those settings describe configuration,
not measured capacity or deployment status.

Do not reduce customer Functions to fractional CPUs because sequential smoke
CPU usage is low. Concurrent customer workloads need their own measurements.
Verify the runtime's CPU/concurrency constraints before changing a profile.

After a resource change, verify repeated successes, correct business state,
and CPU/memory samples for the new revision. Use the complete email isolation
gate before any hosted traffic. A source edit does not establish deployment
or a corrected production workload.

## Reusable read-only command

```text
node scripts/load/resources.mjs --project santas-workshop-test --start <UTC-start> --end <UTC-end> --functions scheduledDateTimeSlotCounters,newAccount,saveDraftChild,completeRegistration --output artifacts/load/resources.json
```

Use an observation window no longer than 24 hours and allow three minutes
after its end for metrics to settle. Omitting `--functions` produces an
inventory report, not an acceptance decision. `smoke` and `run` select their
required functions from the completed journeys and include the email worker,
public-parameters gateway, and scheduled counter when applicable.
