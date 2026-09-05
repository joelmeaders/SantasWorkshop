# Customer application architecture

The customer application uses standalone Angular and Ionic, Firebase Auth,
Firestore, Cloud Functions, and Firebase Storage. Shared services are in
`santashop-core`; record contracts are in `santashop-models`.

## Routes and workflow

| Route | Behavior |
| --- | --- |
| `/` | Account entry, sign-in, and password reset |
| `/sign-up` | Account creation, required referral selection, and legal acceptance |
| `/pre-registration/overview` | Child editing, appointment selection, review, and submission |
| `/pre-registration/confirmation` | Submitted registration, QR image, appointment changes, and cancellation |
| `/pre-registration/profile` | Account information, email, and password controls |

The route definitions are `santashop-app/src/app/app.routes.ts` and
`features/pre-registration/pre-registration.routes.ts`. Auth guards protect the
registration shell. Completion guards select overview or confirmation; the
check-in guard restricts the customer workflow after check-in. Maintenance,
weather, and registration settings control blocking overlays.

## Data and mutations

`newAccount` validates account and referral fields, creates the Auth identity,
and writes `users/{uid}` and `registrations/{uid}`. It generates the QR image at
`qrCodeStoragePath` and records generation success or failure. The client reads
that stored path; a missing path produces no image.

`PreRegistrationService` exposes registration, children, appointment, and QR
state. Overview cards call `saveDraftChild`, `deleteDraftChild`, and
`setDraftAppointment` to edit children and select a slot. `completeRegistration`
validates submission and queues confirmation email. Profile controls use Auth
reauthentication and the account callables. `changeRegistrationDateTime` handles
appointment changes after submission. The confirmation page exposes cancellation
through `undoRegistration` when its feature flag allows it.

Firestore rules restrict customer writes. Server handlers enforce privileged
mutations independently of route guards. ZIP values are strings. Customer
records use the shared model directly without a profile-version field.

## Email and appointment availability

Templated email references a published template by `templateKey`. Published
revisions define SES template names and placeholder mappings. Missing keys or
unpublished templates fail explicitly. QR placeholders use `qrCodeUrl`. Cancellation notices use a separate inline message.
The email trigger runs on queue-document creation; rewriting an existing queue
document does not create another trigger event. SES acceptance does not prove
recipient delivery.

Appointment availability is recalculated by a scheduled function. Operators
manually increase its frequency during high demand. Capacity is a soft limit;
overbooking is acceptable. Registration statistics and schedule counts have
different aggregation purposes and remain separate.

## Configuration and validation

The root configuration generators use explicit environment prefixes. See
[configuration](../SECRETS_AND_CONFIGURATION.md) and
[testing](../testing/e2e.md). Build shared models and core before the app.
Unit tests cover services, forms, guards, and pages; emulator browser tests
cover the customer journey. Emulator evidence does not establish hosted behavior.

See [workflow](diagrams/public-app-workflow.mmd) and
[data flow](diagrams/data-and-function-flow.mmd).
