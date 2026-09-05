# Admin data freshness

## Read contract

The admin application retains Firestore snapshot listeners for two feature groups:

| Feature                                               | Data                                       | Refresh behavior                                                                                            |
| ----------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Operational feature flags                             | `parameters/public`                        | Live through `RealtimePublicParametersSource` and `AppStateService`                                         |
| Schedule editing and appointment selection            | `dateTimeSlots`                            | Live in the schedule editor, pre-registration form, and change-date modal                                   |
| Registration report, including capacity charts        | Registration/schedule aggregates and slots | Firestore Lite; all inputs reload together on entry, year change, or Refresh report                         |
| Check-in and user reports                             | Aggregate documents                        | Firestore Lite; reload on entry, year change, or Refresh report                                             |
| Staff management                                      | `staff`                                    | Firestore Lite; reload on entry, Refresh users, and successful create/update/delete/password changes        |
| Scan-risk list and customer timeline                  | Risk summaries, attempts, check-in         | Firestore Lite; reload on entry or the refresh button; Load more preserves the current list size on refresh |
| Search results                                        | Registration search index                  | Firestore Lite; run the query on entry or Refresh results without re-entering criteria                      |
| Registration, check-in, and duplicate-account lookups | Registration, check-in, customer documents | Firestore Lite; fetch once per lookup action                                                                |

`AdminReadRepository` imports `firebase/firestore/lite`. Each subscription starts
one server request and completes. Requests are deferred until subscription;
errors propagate to the calling screen. Reports and staff data share each
request across their UI consumers. Report, staff, risk, and search errors can be
retried through their refresh controls. No periodic polling was added to these
screens. Existing polling for an in-progress owner operation remains necessary
to show job completion.

The older shared `FireRepoLite` class is a full Firestore snapshot wrapper,
despite its name. Admin usage is restricted to operational flags and the three
schedule/appointment consumers. Their live slot subscriptions release the
listener when the last consumer unsubscribes.

Refreshing a report fetches the latest stored aggregates; it does not run the
backend aggregation job. Live slot updates improve displayed freshness but do
not provide concurrency guarantees. Capacity and duplicate check-in decisions
must remain authoritative on the server.

Audit correction: `AppStateService.allowChangeRegistration$` exists, but the
admin UI does not consume it. The earlier assessment overstated this control's
current UI coverage. This read/refresh change preserves existing permission
behavior; wiring that flag into admin actions is a separate behavior change.

## Verification

Validated locally on 2026-09-04: 250 admin unit tests (52 files, 91.47% line
coverage), 127 shared-core unit tests, and all 59 admin E2E tests on Pixel 5
Chromium (3.5 minutes). Admin lint and E2E TypeScript/ESLint checks passed.
The production build and bundle guard passed: 944.59 kB initial raw output,
148.55 kB estimated transfer, and 1,272,968 bytes in the static JavaScript graph.
The initial raw size matches the prior measurement; full Firestore remains
deferred and Firebase Storage is absent. Local config was restored after tests
and the build. No deployment was performed.

- Unit tests exercise one-request completion, fresh resubscription, missing
  records, errors, retry, shared report requests, year selection, staff mutation
  refreshes, search retry, risk pagination refresh, and live slot teardown.
- `refresh-and-live-data.spec.ts` exercises stale-then-refresh reports and risk
  views, report read failure/recovery, and changes arriving without refresh in
  both retained live feature groups.
- Search tests verify refreshing the same criteria. Staff tests verify automatic
  refresh after mutation and manual refresh in a second open view.
- The remaining admin E2E suite covers access controls, lookup, registration,
  check-in, duplicate/canceled scans, schedule editing, staff changes, email
  tools, owner operations, reporting, and accessibility.
- E2E execution currently enables only `mobile-chrome` (Pixel 5 Chromium), with
  one worker. Compatibility specs are retained, while extra browser projects
  and their installation steps are disabled.

Full Firestore remains deferred behind authenticated routes because the two
live feature groups still require it. The initial-bundle check also rejects
Firebase Storage and enforces the existing size limit. Using Lite for other
reads removes their listeners; it does not eliminate the retained full SDK.
