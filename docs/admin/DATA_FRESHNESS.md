# Admin data freshness

| Feature | Data | Refresh behavior |
| --- | --- | --- |
| Operational flags | Remote Config `santashop_public_parameters` | Activated settings, real-time listener, and visible-tab fetch fallback |
| Schedule editor and appointment controls | `dateTimeSlots` | Snapshot listeners |
| Reports | Aggregates and report slots | Reload together on entry, year change, or Refresh report |
| Staff | `staff` | Reload on entry, refresh, and successful mutation |
| Scan risk | Summaries, attempts, and check-in | Reload on entry or refresh; preserve expanded list size |
| Search | Registration index | Query on entry or refresh with the same criteria |
| Registration and check-in lookups | Individual records | Fetch once per action |
| Owner operation | Job status | Poll while active; recover with Refresh operation status |

`AdminReadRepository` imports `firebase/firestore/lite`. Each subscription
starts one deferred server request and completes. Errors reach the screen's
refresh control. Reports and staff views share each request among UI consumers.
A failed owner status request resumes with the same job ID and does not start
another operation.

`FireRepoLite` is a full Firestore snapshot wrapper despite its name. Admin
consumers use it for appointment controls. Operational flags use
`PUBLIC_PARAMETERS_SOURCE`; see [Remote Config](../remote-config.md). Slot listeners
release when their last consumer unsubscribes. Full Firestore loads behind the
authenticated route; the initial bundle check also excludes Firebase Storage.

Report refresh reads stored aggregates. It does not run aggregation. Live slot
updates do not enforce hard capacity: overbooking is acceptable, and scheduled
reconciliation updates counters. Operators manually adjust the schedule during
high demand. Duplicate check-ins are rejected by the server.

New registration and user aggregates include their calculation times. Reports
label each data source separately and show unavailable times or calculations
for older documents. Check-in totals retain their existing `lastUpdated` time.
See [analytics and reporting](../analytics-and-reporting.md) for population,
snapshot, export, and legacy-data definitions.

`AppStateService.allowChangeRegistration$` exists but is not consumed by the
admin UI. Server authorization remains the enforcement boundary.

Unit tests cover deferred reads, completion, errors, retries, shared requests,
year selection, and listener teardown. Emulator browser tests cover navigation,
refresh, disconnected reads, concurrent check-in, lost responses, appointment
changes, and owner-status recovery. Playwright uses mobile Chromium plus a bounded desktop Chromium smoke project
and one worker; concurrency cases create isolated contexts within a test.
These checks do not prove external email delivery or production behavior.
