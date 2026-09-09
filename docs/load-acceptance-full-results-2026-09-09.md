# Full load attempt: September 9, 2026

## Outcome

The requested full load test ran with browser smoke explicitly skipped. It did
not complete or pass acceptance. The configured five-minute instance-ceiling
guard stopped arrivals at the public-parameters gateway. Post-stop resource
evidence also failed the memory-headroom gate for `completeRegistration`.

No production deployment or production data change occurred. Test email
isolation remained active. Simulated delivery does not prove SES delivery, and
the registered App Check debug provider does not prove normal reCAPTCHA
attestation.

## Work completed

Run: `load-20260909T214751Z-5ee4fa84`, harness commit
`44aa3b6c43d8f641ae2ad84b94aceb9c64656c3f`, project `santas-workshop-test`.
Started at 21:47:51 UTC. The stop was recorded at 21:53:42 UTC; read-only
business verification passed at 21:55:34 UTC.

| Phase                                              | Target                                         | Observed                                      |
| -------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Browser smoke                                      | Omit by operator instruction                   | Skipped; no fresh UI journeys                 |
| Calibration                                        | 24 signups in two minutes                      | 24 completed                                  |
| Sustained signup                                   | 1,080 arrivals in 15 minutes                   | 214 offered over 177.5 seconds; 212 completed |
| Signup bursts and completion cluster               | Three bursts and nine simultaneous completions | Not reached                                   |
| Staff, duplicate scans, and interrupted completion | Planned staff and recovery phases              | Not reached                                   |

Read-only Auth lookup found all 238 attempted accounts with 238 unique email
addresses and none missing. Business verification found 238 corresponding
registrations: 236 complete and two drafts when the stop halted further calls.
All 236 completed records had three children and the expected QR data. Their
slot count reconciled to 236, and no email work remained pending. The fixtures
were retained.

There were no unexpected client request errors in this run. The intentional
missing-App-Check request returned the expected HTTP 401. All observed sustained
signup operations had 100% of requests under two seconds; their per-operation
p99 values ranged from 171 to 784 ms. Calibration had one `newAccount` request
at 2,159 ms, so that phase did not meet the 99% under-two-seconds requirement.
Its cause has not been established as a cold start or CPU shortage.

## Stop condition

The gateway has one CPU, concurrency 80, and `maxInstances: 1`. Five consecutive
active-instance samples reached that maximum. The harness therefore stopped as
configured. The gateway is used indirectly by customer Functions for settings,
so it remains part of resource acceptance even when browser smoke is skipped.

This is not evidence of CPU or concurrency exhaustion: the settled window had
77 successful gateway requests, CPU p95 bounded at 1%, and observed concurrency
bounded below two against the configured limit of 80. The instance rule is a
conservative capacity gate. It was not weakened or bypassed to continue load.

## Memory and CPU evidence

The read-only resource collector covered 21:47:51 through 21:56:00 UTC and was
rerun after the three-minute sampling/ingestion wait. It joined only the current
deployed revisions. Percentages below are histogram upper bounds, not exact
peaks. Seven workload Functions and the isolation probe had request and resource
samples; the other 34 Functions were unmeasured in this window.

| Function                      |  Memory |    CPU |                    Requests | Memory peak bound | CPU p95 bound | Result                                   |
| ----------------------------- | ------: | -----: | --------------------------: | ----------------: | ------------: | ---------------------------------------- |
| newAccount                    | 512 MiB |      1 | 239, including expected 401 |               38% |           11% | Observed headroom                        |
| saveDraftChild                | 256 MiB |      1 |                         711 |               80% |            8% | At the 20% headroom boundary             |
| setDraftAppointment           | 256 MiB |      1 |                         237 |               75% |            4% | Observed headroom                        |
| completeRegistration          | 256 MiB |      1 |                         236 |               81% |            4% | Fails 20% memory headroom                |
| sendNewRegistrationEmails     | 256 MiB |      1 |                         236 |               77% |           10% | Observed headroom with sink delivery     |
| scheduledDateTimeSlotCounters | 256 MiB | 0.1666 |                           2 |               62% |            4% | Repaired counter passes at this workload |
| publicParametersGateway       | 256 MiB |      1 |                          77 |               68% |            1% | Resource headroom; instance stop applies |
| emailIsolationProbe           | 256 MiB |      1 |                           9 |               46% |            1% | Probe coverage only                      |

No memory-limit termination, HTTP 5xx response, or deadline failure was found
for these revisions in this window. The resource assessment still fails because
`completeRegistration` has only 19% headroom by the conservative bound. This is
a headroom failure, not an observed out-of-memory event. Low CPU use does not
justify reducing the full CPUs needed for configured concurrency.

The counter correction from 128 to 256 MiB was deployed only to test by
[release run 34360878598](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34360878598).
Its fractional CPU also rose from 0.0833 to 0.1666. This closes the previously
observed counter memory failure at the measured workload; it does not establish
full historical-load capacity.

## Harness corrections and cost

Earlier calibration attempts stopped when the harness requested QR media
directly and received HTTP 403. The hosted app instead uses `getDownloadURL`:
authorized metadata followed by the returned token URL. The harness now follows
that flow, checks metadata ownership, and keeps tokens out of the journal. All
236 completed journeys in the reported run retrieved their QR image successfully.
An unrelated workspace file also caused one pre-fixture stop; execution then
moved to an isolated worktree.

The pre-load one-hour projection was $18.35. The final recorded conservative
ceiling for this run was $6.66, including a $5 allowance. These are configured
compute ceilings, not billed costs or a cumulative bill for earlier attempts.
Arrivals stopped before the $20 threshold; the total budget remains $25 with
$5 reserved for drain. The retained network connector has continuing cost.

## Follow-up before another full attempt

- Test a larger `completeRegistration` memory allocation, such as 512 MiB,
  while retaining one CPU. Recheck `saveDraftChild`, which reached the boundary.
- Resolve the gateway's one-instance limit against the agreed instance guard.
  Keeping that guard would require a higher configured ceiling, for example
  two instances. Current evidence does not support increasing its CPU or memory.
- Investigate the 2.16-second calibration request before changing warm-instance
  or cache settings.
- Repeat the complete workload after those decisions. The bursts, staff paths,
  duplicate handling, recovery phase, and sustained 15-minute target remain
  unverified by this run.

Local evidence is under `artifacts/load/load-20260909T214751Z-5ee4fa84/` in the
execution worktree: `events.jsonl`, `summary.json`, `auth-verification.json`, and
the post-stop `resources.json`. The original summary correctly leaves its
integrated resource check unset because the stop occurred before that gate;
the separate settled resource report records the failure. No acceptance-pass
event was emitted.
