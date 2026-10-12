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

## Presentation

The admin uses neutral surfaces, restrained red actions, and visible borders in
`src/theme/variables.scss`. Form fields use transparent backgrounds with visible
borders and focus outlines. Navigation controls use flat surfaces.
Large cards use a subtle shadow. Reuse the surface, border, and accent tokens
in page styles so light and dark modes share the same layout.

Schedule generation and per-slot editing use native details controls. The closed
view shows the time, reservation count, and availability. Opening a row reveals
its date, hour, capacity, enabled state, save action, and delete confirmation.
Capacity and enabled changes retain their existing immediate-save behavior.
Date and hour drafts still require Save time slot.

Registration forms pair name and contact fields on wider screens. Referral,
children, appointment, and confirmation sections span the form width. Reports
keep the program year and refresh action together, and tables support horizontal
scrolling. Keep controls readable in light, dark, and forced-color modes.
The device-local appearance preference supports System, Light, and Dark.
Language and appearance changes preserve the current form and route.

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
