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
to show job completion. If a status request fails, Refresh operation status
resumes reads for the same job ID without starting another operation.

The older shared `FireRepoLite` class is a full Firestore snapshot wrapper,
despite its name. Admin usage is restricted to operational flags and the three
schedule/appointment consumers. Their live slot subscriptions release the
listener when the last consumer unsubscribes.

Refreshing a report fetches the latest stored aggregates; it does not run the
backend aggregation job. Live slot updates improve displayed freshness but do
not provide concurrency guarantees. Duplicate check-ins are rejected on the
server. Appointment capacity is a soft limit: `changeRegistrationDateTime`
deliberately leaves slot counters for scheduled reconciliation. Two staff
members can move different registrations into the same last available slot.
The concurrency E2E test records this existing behavior; it does not establish
hard-capacity enforcement. A hard limit requires a separate backend change.

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

## Expanded regression coverage

Validated locally on 2026-09-05: all 72 admin E2E tests passed on mobile
Chromium (4.9 minutes), including 13 new scenarios. All 255 admin unit tests
passed (52 files, 91.83% line coverage). Admin lint, E2E TypeScript/ESLint,
and the production bundle guard passed. Initial raw output remains 944.59 kB;
the static JavaScript graph is 1,272,967 bytes. No deployment was performed.

The 2026-09-05 additions cover:

- Report and staff list reloads after in-app back navigation, without a document reload.
- Scan-risk back navigation and refresh with an expanded results list.
- Report year selection, refresh of that year, and clearing missing-year data.
- Failed registration/check-in report reads, staff queries, and disconnected search requests, followed by a successful retry.
- Two signed-in staff contexts checking in the same registration. Exactly one succeeds; the other receives a blocked result backed by persisted scan-audit evidence.
- A successful check-in whose response is lost. Retrying cannot issue a second confirmation.
- Concurrent appointment changes with the existing soft-capacity behavior and persisted registration/slot evidence.
- Owner status-read failure and recovery for the same job, with only one start request.
- Owner access removed after preview, followed by real UI reauthentication and a denied start request.

The suite still uses one mobile Chromium project and one worker. Concurrency
tests use two isolated mobile contexts within one test. Failure traces are
retained without enabling retries. Camera decoding is excluded by request.
Emulator checks do not prove production behavior or external email delivery.
