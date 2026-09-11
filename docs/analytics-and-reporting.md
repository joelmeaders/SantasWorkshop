# Analytics and reporting

Customer journey events and staff reports answer different questions. Analytics
events describe browser actions. Firestore aggregates describe stored business
records. Browser events can be blocked or lost, so use the aggregates for
operational totals.

## Event contract

The shared [event contract](../santashop-core/src/lib/services/analytics-events.ts)
defines event names, allowed parameters, and operation outcomes. The
[Analytics wrapper](../santashop-core/src/lib/services/_analytics-wrapper.ts)
filters parameters before sending them. Keep customer names, email addresses,
child identifiers, registration codes, and free-form error messages out of these
events. Unknown errors use a fixed category.

Each event includes `event_schema_version: 2`, the active application language,
application area, and program year when available. These describe the current application session.
They do not identify a customer. Initialization or event-delivery failures must
not stop an application from starting or change the result of a business action.

`workflow_action` separates attempted, succeeded, and failed operations. A
successful operation event describes an acknowledged server call. A failure
means the client operation rejected. A lost response can follow a server commit.
Use stored aggregates for the committed totals. A later refresh or
navigation failure must not turn that successful mutation into a failed one.
Retried operations can produce more than one browser event. Do not treat event
counts as unique registration counts.

`app_error` stores an allowed error code and operation as parameters. Firebase
error codes are not event names. Google requires event names to start with a
letter and contain only letters, numbers, and underscores. See the
[GA4 event naming rules](https://support.google.com/analytics/answer/13316687?hl=en).

Existing success names remain where their meaning is useful. Filter by
`event_schema_version: 2` when reporting the corrected semantics. In this version,
`cancel_registration` and `change_registration_datetime` describe successful
server operations. Older versions emitted these events before success.
`confirmed_email` means the user confirmed the address in the dialog. It does
not mean an email verification link was followed. Use
`email_confirmation_dialog` for confirmed and dismissed dialog outcomes.

## Registration funnel

Use the explicit signup, account creation, child editing, appointment, review,
and submission events to inspect the customer journey. Compare failure outcomes
and recovery actions by language and program year. A resumed registration need
not repeat signup or every earlier editing step, so distinguish new and resumed
journeys when interpreting a funnel.

## Saved reports and older data

New registration and user aggregates add optional metadata and calculations to
the existing yearly documents. Existing fields remain readable by older
clients. New clients also accept reports with none of the new fields.

- A missing timestamp means the calculation time is unavailable. Refresh reads
  the saved document and does not run the aggregation job.
- A missing new calculation means unavailable. It must not become zero.
- A recorded zero remains zero in the screen, table, and CSV.
- Registration counts and child demographics can have different calculation
  times. The screen labels each source separately.
- Historical user totals retain their original meaning. New `population:
  'all-users'` aggregates count all stored user profiles and count missing ZIP
  and referral values independently in the unknown buckets.

Registration outcomes cover current retained registration records that belong
to the selected program year. Completion rate is submitted records divided by
that population. It is not an all-time signup conversion rate. Attendance uses
past appointment dates and explicit attendance status. An unconfirmed past
appointment is not a proven no-show. Missing legacy attendance fields prevent
an unsupported attendance rate.

Daily registration snapshots retain the first observation for each local
calendar day. Gaps mean no saved observation for that day, not zero activity.
These snapshots describe observed state, not the number of new registrations
on that date. The annual document retains snapshots when a later calculation
has fewer source records.

Profile creation trends use the Firestore profile document creation time. They
count observed stored profiles, not Firebase Auth signups. The retained maximum
observed count for each date is a lower bound and can exceed the remaining user
population after records are removed. Dates that cannot be assigned to the
program year are reported separately.

All daily dates use the configured event timezone. The annual reset retains
statistics under the existing reset contract. No migration or historical
customer-data rewrite is needed for this schema. Older years remain readable
without recalculation. Do not backfill unavailable history from guessed values.

## Tables and CSV

Tables provide the complete distributions behind the summary charts. The
registration ZIP chart includes the remaining ZIP codes in an Other slice.
Exports include report context and all table rows, not only the top chart rows.
CSV quoting preserves commas, quotes, and line breaks. Text that could be
interpreted as a spreadsheet formula is escaped. Exports contain aggregate
data only.

## Validation and GA4 setup

Local tests validate event names, allowed parameters, failure isolation,
operation outcomes, aggregate populations, repeated calculations, legacy
reports, and CSV output. Browser tests use the verified emulators and include
old reports, new reports, and downloads. Emulator and mocked-SDK tests do not
prove GA4 ingestion.

Before using new event dimensions in a deployed dashboard:

1. Confirm the Firebase project, GA4 property, web stream, and hostname match.
   Test and production use separate measurement IDs in the environment inputs.
2. Register the contract parameters needed for reporting as event-scoped custom
   dimensions. Use the exact parameter names `operation`, `outcome`, `language`,
   `app_area`, `program_year`, `error_code`, and `event_schema_version` as
   applicable to the report. The bounded `reason`, `action`, `disposition`, and
   `time_category` parameters support recovery and scan reports.
3. In the test property, use DebugView to inspect representative successful,
   failed, dismissed, and resumed journeys. Verify that forbidden identifiers
   and free-form messages are absent.
4. Check that SPA navigation emits one page view per intended route transition.
   Inspect the stream's enhanced-measurement setting before adding a second
   page-view tracker.
5. Build the funnel from the event definitions above. Validate its totals and
   recovery paths before interpreting historical comparisons across versions.

Firebase documents custom definitions and immediate testing in
[Log events](https://firebase.google.com/docs/analytics/web/events).
Record deployed evidence separately from source, unit, and emulator evidence.

## Rollout

Deploy through the existing release gates. Aggregate fields are additive, so
either application or backend can be upgraded first. New calculations appear
after the existing scheduled jobs run. This change does not alter seasonal
schedules or enforce a hard appointment-capacity limit.

An older backend can replace a yearly report without the new fields. The new
UI will fall back to unavailable calculations while preserving old totals.
Retain saved statistics before a backend rollback if the new snapshot history
must remain available. An application rollback does not require data changes.
