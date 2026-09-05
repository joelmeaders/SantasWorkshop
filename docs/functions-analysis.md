# Functions reference

`santashop-functions/src/index.ts` defines exported triggers and their runtime
options. Handler modules are loaded on invocation. Production callables enforce
App Check; handlers enforce customer identity or staff capabilities as required.
Firebase deployment selects Node.js 24.

## Customer and staff mutations

Account handlers create accounts, change account information or email, and
validate required fields. Draft handlers save/delete children and set an
appointment. Submission, appointment changes, cancellation, staff registration,
and check-in handlers enforce server-side rules. `resolveRegistrationScan`
records scan evidence and returns a display-safe outcome.

Staff-management handlers write `roles` claims and staff records. Owner-only
handlers preview, start, inspect, and retrieve exports for serialized operations.
`ownerOperationWorker` processes private resumable tasks with recorded stages.

## Templates and email

Template callables list, read, save, delete, publish, and test revision-backed
email templates. Sending resolves a published `templateKey` and its field
mappings. A missing key or unpublished template fails explicitly.

`sendNewRegistrationEmails` invokes `sendRegistrationEmail.ts` when a document
is created in `tmp_registrationemails`. It records delivery claims and SES
acceptance metadata. Queue-document updates do not invoke this creation trigger.
Provider acceptance is distinct from recipient delivery; the application does
not receive a complete SES delivery-event stream.

## Scheduled work

| Export | Purpose |
| --- | --- |
| `scheduledFirestoreBackup` | Firestore backup |
| `scheduledDateTimeSlotCounters` | Reconcile reserved appointment counts and availability |
| `scheduledRegistrationStats` | Registration and demographic aggregates |
| `scheduledUserStats` | User aggregates |
| `scheduledCheckInStats` | Check-in aggregates |

Schedules and program year come from generated runtime configuration. Operators
manually increase appointment-counter frequency during high demand. Capacity is
a soft limit. Customer data resets annually; statistics and settings remain.

## Test helpers and evidence

Emulator-only exports seed and inspect test data and clear disposable test data.
They assert emulator execution and are not created for production. Unit tests
mock external services; integration tests use Firebase emulators. Neither test
type establishes SES recipient delivery or deployed capacity.

See [configuration](SECRETS_AND_CONFIGURATION.md),
[yearly startup](yearly-startup.md), and [test coverage](TEST_COVERAGE_AUDIT.md).
