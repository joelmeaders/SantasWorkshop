# Admin application architecture

The admin application uses standalone Angular and Ionic with Firebase Auth,
Firestore, and callable Cloud Functions. The route trees are
`santashop-admin/src/app/app.routes.ts` and `admin.routes.ts`.

## Access and workflows

Firebase custom claims contain `roles` (`admin`, `checkin`) and an optional
`owner` flag. Owners have administrative access. Route guards control screen
access; server handlers and database rules enforce capabilities on each request.

| Area             | Responsibility                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Check-in         | Resolve scanned codes, review registration, record check-in, and show duplicates                  |
| Search           | Query submitted-registration indexes by name and string ZIP, email, or code                       |
| Registration     | Staff pre-registration, on-site registration, appointment changes, cancellation, and email resend |
| Reports          | Display registration, schedule, check-in, and user aggregates by year                             |
| Staff            | Manage staff identities and role claims                                                           |
| Email templates  | Edit revisions, preview mappings, publish SES templates, and send test email                      |
| Scan risk        | Inspect risk summaries and recorded scan attempts                                                 |
| Owner operations | Preview and execute authorized exports, yearly reset, and schedule initialization                 |

Administrative routes use `adminOnlyGuard`; owner routes use `ownerOnlyGuard`.
Server capability checks remain authoritative when claims change during a session.
Duplicate check-in protection is enforced in server transactions.

## Data flow

Lookups, reports, staff, and risk views use `AdminReadRepository` with Firestore
Lite. Appointment controls use Firestore snapshot listeners. Operational flags
use [Remote Config](../remote-config.md) through the shared public-parameters source.
[Data freshness](DATA_FRESHNESS.md) specifies refresh and recovery behavior.

Privileged writes pass through callable Functions. Registration indexes support
search without downloading all registrations. ZIP queries use string equality,
which preserves leading zeros. Email tools publish revision-backed template
references; template sending requires a published key and explicit placeholder mappings.

Template subjects and HTML support plain placeholders such as `{{firstName}}`
and `{{contact.name}}`. Preview, save, publish, and test-send validation reject
helpers, blocks, comments, raw/triple-brace expressions, malformed delimiters,
and unsafe property paths. Sample values are substituted as written, matching
SES rendering; the preview does not execute template code.

Scheduled jobs write aggregate documents. Schedule counts measure reservations;
registration statistics also group demographic data. Refreshing a report reads
stored aggregates and does not run a job. Appointment capacity is a soft limit.

Owner operations record previews, confirmation, resumable job stages, and audit
data. The yearly reset clears customer data while retaining staff, settings,
statistics, templates, exports, and owner records. See
[yearly startup](../yearly-startup.md) for the operator procedure.

## Validation

Admin unit tests cover guards, repositories, services, and views. Emulator
browser tests cover access, operational workflows, refresh recovery, and
concurrent requests. The bundle check constrains initial JavaScript size and
keeps full Firestore behind authenticated routes. Test results describe the
environment and revision actually tested; local checks do not establish deployment.

See [workflow](diagrams/admin-app-workflow.mmd) and
[data flow](diagrams/admin-data-and-function-flow.mmd).
