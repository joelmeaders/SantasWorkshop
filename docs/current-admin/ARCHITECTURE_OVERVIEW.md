# Santashop current admin app architecture overview

## Scope

This document maps the current `santashop-admin` workflow and its supporting code paths so the team can later simplify the operator experience, admin data flows, and backend interactions.

Scope for this pass:

- Admin Ionic/Angular app in `santashop-admin/`
- Shared contracts and wrappers used by the admin app in `santashop-core/` and `santashop-models/`
- Firebase callable functions and stats documents used by admin workflows in `santashop-functions/`

Out of scope for deep detail:

- Public customer app except where admin flows mutate the same records
- Styling, translation copy, and low-level UI implementation details that do not materially change operator behavior
- Deployment, auth bootstrap internals, and Firestore security rules

## System boundary

The admin app is a standalone Ionic/Angular client for authorized staff and volunteers.

High-level runtime dependencies:

- Firebase Auth for staff sign-in
- Firebase custom `admin` claim for route and backend authorization
- Firestore for registration lookup, search index reads, check-in reads, stats dashboards, and runtime parameters
- Cloud Functions for privileged mutations such as pre-registration, on-site registration, check-in, resend email, cancel registration, and date/time changes
- Shared `AppStateService` feature flags sourced from `parameters/public`
- Chart.js / `ng2-charts` for stats pages

## Codebase map

| Area | Main files | Why it matters |
| --- | --- | --- |
| Route tree | `santashop-admin/src/app/app.routes.ts` | Defines the admin workflow, auth gate, and feature areas |
| Admin shell | `santashop-admin/src/app/pages/admin/admin.page.ts` | Bottom-tab shell and feature-flag-aware navigation |
| Landing/dashboard | `santashop-admin/src/app/pages/admin/landing/landing.page.ts` | Main operator navigation hub |
| Search flow | `santashop-admin/src/app/pages/admin/search/**/*`, `search.service.ts`, `lookup.service.ts` | Provides search by name/email/code over `registrationsearchindex` and lookup into `registrations` |
| Check-in flow | `scan.page.ts`, `review.page.ts`, `confirmation.page.ts`, `duplicate.page.ts`, `check-in-context.service.ts`, `check-in.service.ts` | Core scan/review/check-in workflow |
| Admin registration flows | `pre-registration.page.ts`, `registration.page.ts` | Admin-created preregistration and on-site registration/check-in |
| Resend email tool | `tools/resend-email/resend-email.page.ts` | Manual requeue of registration email delivery |
| Stats dashboards | `stats/registration.page.ts`, `stats/check-in.page.ts`, `stats/user.page.ts` | Reads aggregated stats docs and slot data for reporting |
| Backend mutations | `santashop-functions/src/fn/callableAdminPreRegister.ts`, `onSiteRegistration.ts`, `checkIn.ts`, `checkInWithEdit.ts`, `callableResendRegistrationEmail.ts`, `undoRegistration.ts`, `changeRegistrationDateTime.ts` | Implements privileged admin mutations |

## Route and page catalog

### Entry route

| Route | Page | Purpose | Primary reads | Primary writes / calls | Gate |
| --- | --- | --- | --- | --- | --- |
| `/` | `SignInPage` | Staff sign-in form | None | Firebase Auth `login()` | Redirects logged-in users to `/admin` |

### Admin shell and task routes

| Route | Page | Purpose | Primary reads | Primary writes / calls | Gate |
| --- | --- | --- | --- | --- | --- |
| `/admin` | `AdminPage` | Tab shell for check-in, search, and registration-related tasks | `preRegistrationEnabled$`, `onsiteRegistrationEnabled$`, `checkinEnabled$` | None | Requires Firebase auth + `admin` custom claim |
| `/admin/landing` | `LandingPage` | Operator landing/dashboard and feature entry hub | same feature flags plus email-derived `isAdmin$` helper | logout and theme toggle only | Requires Firebase auth + `admin` claim |
| `/admin/checkin/scan` | `ScanPage` | QR scanning entry point for existing registrations | camera devices + registration lookup by QR code | stores registration in context | Requires Firebase auth + `admin` claim |
| `/admin/checkin/review` | `ReviewPage` | Review/edit scanned registration before check-in | current registration context, `checkinEnabled$`, `allowCancelRegistration$` | callable `checkIn`, `checkInWithEdit`, `changeRegistrationDateTime`, `undoRegistration` | Requires Firebase auth + `admin` claim |
| `/admin/checkin/confirmation` | `ConfirmationPage` | Success screen after check-in or on-site registration | check-in result context | None | Requires Firebase auth + `admin` claim |
| `/admin/checkin/duplicate/:uid` | `DuplicatePage` | Shows an already-existing check-in record when duplicate check-in occurs | `checkins/{uid}` | None | Requires Firebase auth + `admin` claim |
| `/admin/search` | `SearchPage` | Hub page for search modes | None | None | Requires Firebase auth + `admin` claim |
| `/admin/search/by-name` | `ByNamePage` | Search form by last name + zip | None directly | populates `SearchService` query state | Requires Firebase auth + `admin` claim |
| `/admin/search/by-email` | `ByEmailPage` | Search form by email | None directly | populates `SearchService` query state | Requires Firebase auth + `admin` claim |
| `/admin/search/by-code` | `ByCodePage` | Search form by QR code | None directly | populates `SearchService` query state | Requires Firebase auth + `admin` claim |
| `/admin/search/results` | `ResultsPage` | Shows and sorts search results | `SearchService.searchResults$` | None | Requires Firebase auth + `admin` claim |
| `/admin/registration` | `RegistrationPage` | One-step on-site registration plus immediate check-in | local form state only | callable `onSiteRegistration` | Requires Firebase auth + `admin` claim |
| `/admin/pre-registration` | `PreRegistrationPage` | Creates a preregistered customer account and queued email | users-by-email duplicate check, available slots | callable `callableAdminPreRegister` | Requires Firebase auth + `admin` claim |
| `/admin/resend-email` | `ResendEmailPage` | Finds a customer by email and requeues their registration email | `registrationsearchindex` by email | callable `callableResendRegistrationEmail` | Requires Firebase auth + `admin` claim |
| `/admin/stats/registration` | `RegistrationPage` (stats) | Registration and capacity reporting | `stats/registration-{year}`, `stats/schedule-{year}`, `dateTimeSlots` | None | Route is outside `/admin` shell but intended for admins |
| `/admin/stats/check-in` | `CheckInPage` | Check-in volume and preregistration/on-site reporting | `stats/checkin-{year}` | None | Route is outside `/admin` shell but intended for admins |
| `/admin/stats/user` | `UserPage` | User/referrer/zip distribution reporting | `stats/user-{year}` | None | Route is outside `/admin` shell but intended for admins |

## Major workflow

```mermaid src="./diagrams/admin-app-workflow.mmd" alt="Santashop admin app workflow"```

### 1. Staff sign-in and authorization

`SignInPage` captures:

- `emailAddress`
- `password`

Flow:

1. Staff signs in via Firebase Auth.
2. Router sends authenticated users into `/admin`.
3. Route guard then applies `hasCustomClaim('admin')`.

Why it matters:

- The admin app depends on both client-side route gating and server-side callable authorization.
- Many mutations are also protected by the backend checking `request.auth?.token?.admin`.

### 2. Landing/dashboard flow

`LandingPage` and `AdminPage` expose navigation to the main staff tasks:

- check-in
- search
- on-site registration
- pre-registration
- resend email
- stats

These pages are feature-flag aware through `AppStateService`:

- `checkinEnabled$`
- `onsiteRegistrationEnabled$`
- `preRegistrationEnabled$`

Important current-state note:

- `LandingPage.isAdmin$` uses whether the signed-in email contains the substring `admin`, which is a convenience signal, not a trustworthy authorization mechanism.

### 3. Search workflow

The search subsystem has two layers:

- `SearchService` builds and stores search queries against `registrationsearchindex`
- `LookupService` resolves a result into the underlying registration or check-in record

Search modes:

- by last name + zip
- by email
- by QR code

Search source of truth:

- `registrationsearchindex/{uid}`

Results flow:

1. Search form page writes a query into `SearchService`.
2. `ResultsPage` subscribes to the stored observable, sorts it, and renders up to 50 results.
3. Operator can navigate onward to check-in review using the selected record/code.

Why it matters:

- admin search does not query `registrations` directly first; it relies on a denormalized search index.
- anything that fails to create or maintain `registrationsearchindex` becomes operationally invisible to most admin flows.

### 4. Scan → review → check-in workflow

This is the primary existing-registration check-in path.

#### Scan step

`ScanPage`:

- uses camera scanning via ZXing
- normalizes scanned values to uppercase
- throttles repeated scans
- resolves the code through `LookupService.getRegistrationByQrCode$()`

If found:

- `CheckInContextService.setRegistration(registration)` stores the record
- app navigates to `/admin/checkin/review`

If not found:

- alert offers operator recovery, including a path to search

#### Review step

`ReviewPage` lets staff:

- inspect parent/guardian info
- review children
- add/remove/edit children locally in the current context
- change the date/time slot
- delete/cancel the reservation if allowed
- complete check-in

The page tracks whether the operator changed anything with `wasEdited`.

That flag decides which callable is used:

- unchanged → `checkIn`
- edited → `checkInWithEdit`

#### Confirmation step

`ConfirmationPage` displays:

- check-in code
- child count returned by the callable

`CheckInContextService.reset()` runs when the page is left.

#### Duplicate step

If the backend rejects check-in because the target record already has a `checkins/{uid}` document:

- UI routes to `/admin/checkin/duplicate/:uid`
- `DuplicatePage` reads and displays the existing check-in record
- analytics logs an `admin_checkin_duplicate` event

### 5. Admin pre-registration workflow

`PreRegistrationPage` is the admin-assisted “create customer account + submitted registration” flow.

Form captures:

- `firstName`
- `lastName`
- `emailAddress`
- `zipCode`
- `referredBy`
- `newsletter`
- `dateTimeSlot`
- `children[]` managed through shared child-management UI

Flow:

1. Page loads enabled date/time slots for the target year.
2. Operator assembles the registration, including children and referral.
3. Page does a client-side duplicate-account check by querying `users` with the email address.
4. Page calls callable `callableAdminPreRegister`.
5. Backend creates auth/user/registration/index/email artifacts and queues the confirmation email.
6. UI resets the form and shows a success alert.

Behavioral difference from the public app:

- This path creates a fully submitted registration immediately.
- It also creates a real Firebase Auth account for the customer.

### 6. On-site registration workflow

`RegistrationPage` is the walk-in/on-site flow.

Form captures:

- `firstName`
- `lastName`
- `emailAddress`
- `zipCode`
- `referral`
- `newsletter`
- `children[]`

When submitted:

1. UI builds a synthetic registration with placeholders such as `uid: 'onsite'`, `qrcode: 'onsite'`, and `dateTimeSlot.id: 'onsite'`.
2. UI calls callable `onSiteRegistration`.
3. Backend generates a real Firestore id, creates `onsiteregistrations/{id}`, and creates `checkins/{id}` in the same batch.
4. UI stores child-count/code in `CheckInContextService` and routes to check-in confirmation.

Why it matters:

- on-site registration is not the same record lifecycle as preregistration
- it does not create a Firebase Auth account
- it writes to `onsiteregistrations`, not `registrations`

### 7. Resend email workflow

`ResendEmailPage` does manual recovery for registration-email delivery.

Flow:

1. Operator enters customer email address.
2. `LookupService.getSearchIndexByEmailAddress$()` finds the customer via `registrationsearchindex`.
3. Page calls callable `callableResendRegistrationEmail(customerId)`.
4. Backend verifies that the registration exists, is complete, and has a ready QR code.
5. Backend upserts `tmp_registrationemails/{uid}` and resets reminder-email flags on `registrations/{uid}`.
6. UI shows success.

### 8. Stats workflows

The admin app has three read-only reporting pages.

#### Registration stats

Reads:

- `stats/registration-{year}`
- `stats/schedule-{year}`
- `dateTimeSlots` filtered by `programYear`

Shows:

- completed registration totals
- children-per-customer metrics
- gender/age breakdowns
- top zip codes
- slot-capacity charts by day

#### Check-in stats

Reads:

- `stats/checkin-{year}`

Shows:

- last updated time
- total customers
- total children
- preregistered vs on-site counts
- modified registration counts
- charts by day/hour

#### User stats

Reads:

- `stats/user-{year}`

Shows:

- top referrers
- top zip codes

## Data contracts and record mutations

```mermaid src="./diagrams/admin-data-and-function-flow.mmd" alt="Santashop admin app data and function flow"```

### `registrationsearchindex/{uid}`

Primary purpose:

- operator-facing lookup index used for search and scan-adjacent recovery

Fields used by the admin app:

- `code`
- `customerId`
- `firstName`
- `lastName`
- `emailAddress`
- `zip`

Admin workflows that depend on it:

- search by name
- search by email
- search by code
- resend email email-to-customer-id resolution

Fields added or updated by admin-driven workflows:

| When | Mutation source | Fields added or changed |
| --- | --- | --- |
| admin pre-registration | callable `callableAdminPreRegister` | full index document create/upsert |
| cancel reservation from review | callable `undoRegistration` | document deleted |

Important current-state note:

- search workflows are only as complete as this index; missing index docs mean operational blind spots.

### `registrations/{uid}`

Primary purpose:

- submitted customer registration record for preregistered accounts

Fields used by the admin app:

- `uid`
- `firstName`
- `lastName`
- `emailAddress`
- `zipCode`
- `children[]`
- `dateTimeSlot`
- `previousDateTimeSlot`
- `qrcode`
- `registrationSubmittedOn`
- `includedInCounts`
- `includedInRegistrationStats`
- `programYear`
- `qrCodeGeneratedOn`
- `qrCodeGenerationFailedOn`
- `reminderEmailQueuedOn`
- `reminderEmailFailedOn`
- `reminderEmailSentOn`

Fields added or updated by admin-driven workflows:

| When | Mutation source | Fields added or changed |
| --- | --- | --- |
| admin pre-registration | callable `callableAdminPreRegister` | full submitted registration including children, slot, QR code, submission date, stats flags, program year |
| change date/time from review | callable `changeRegistrationDateTime` | `previousDateTimeSlot`, `dateTimeSlot`, `includedInCounts = false`, `reminderEmailSentOn = false`, `reminderEmailFailedOn = false` |
| cancel reservation from review | callable `undoRegistration` | copies current slot into `previousDateTimeSlot`, removes `dateTimeSlot`, removes `registrationSubmittedOn`, sets `includedInCounts = false` |
| resend email | callable `callableResendRegistrationEmail` | `reminderEmailQueuedOn`, `reminderEmailFailedOn = false`, `reminderEmailSentOn = false` |

Behavioral note:

- review-page child edits are held in client context and only become permanent if check-in uses `checkInWithEdit`; they do not write back into `registrations/{uid}` directly.

### `onsiteregistrations/{id}`

Primary purpose:

- archive of walk-in/on-site registrations that are created and checked in immediately

Fields added by admin workflow:

- all submitted registration-like fields from the on-site form
- `uid = generated id`
- `qrcode = onsite`
- `registrationSubmittedOn = Date`
- `includedInCounts = false`
- `includedInRegistrationStats = false`
- `programYear`

Why it matters:

- on-site registration is modeled as a separate lifecycle from standard preregistration
- it bypasses both `users/{uid}` and `registrations/{uid}` creation

### `checkins/{uid or id}`

Primary purpose:

- authoritative record that a customer has been checked in

Fields written by admin check-in flows:

- `checkInDateTime`
- `customerId`
- `registrationCode`
- `inStats`
- `stats`

Which flow writes it:

| When | Mutation source | Notes |
| --- | --- | --- |
| standard check-in | callable `checkIn` | uses current registration without edit archive |
| edited check-in | callable `checkInWithEdit` | also creates `editedregistrations/{uid}` |
| on-site registration | callable `onSiteRegistration` | creates check-in alongside `onsiteregistrations/{id}` |

Important current-state note:

- duplicate detection is effectively “does `checkins/{uid}` already exist?”

### `editedregistrations/{uid}`

Primary purpose:

- archive of operator-modified child data captured during check-in

Fields added by admin workflow:

- `uid`
- `children`
- `registrationSubmittedOn`
- `includedInRegistrationStats = false`
- `programYear`

When created:

- only when `ReviewPage` uses `checkInWithEdit`

### `users/{uid}`

Primary purpose:

- user-account profile record for preregistered customers

Fields added by admin workflow during preregistration:

- `firstName`
- `lastName`
- `emailAddress`
- `zipCode`
- `acceptedTermsOfService = new Date(0)`
- `acceptedPrivacyPolicy = new Date(0)`
- `version = 1`
- `manuallyMigrated = true`
- `newsletter`
- optional `referredBy`

Admin app direct usage:

- duplicate email check before preregistration through `SearchService.searchUsersByEmailAddress()`

### `dateTimeSlots/{id}`

Primary purpose:

- appointment slots used by admin preregistration, date/time editing, and reporting

Fields consumed by the admin app:

- `id`
- `programYear`
- `dateTime`
- `maxSlots`
- `slotsReserved`
- `enabled`
- `lastUpdated`

Admin workflows using it:

- preregistration slot picker
- review-page date/time modal
- registration stats capacity charts

### `tmp_registrationemails/{uid}`

Primary purpose:

- queue document for registration email delivery

Fields written by admin-driven workflows:

| When | Mutation source | Fields added or changed |
| --- | --- | --- |
| admin pre-registration | callable `callableAdminPreRegister` | `code`, `email`, `name`, `formattedDateTime`, `queuedOn`, `queueSource = admin-preregistration`, `deliveryRequestedOn`, `deliveryState = queued`, `failedOn = false`, `lastErrorMessage = false`, `lastErrorDetails = false` |
| change date/time from review | callable `changeRegistrationDateTime` | requeues updated date/time email with `queueSource = date-time-change` |
| resend email tool | callable `callableResendRegistrationEmail` | requeues email with `queueSource = manual-resend` |

### `stats/{docId}`

Primary purpose:

- scheduled aggregate reporting documents

Docs consumed by the admin app:

- `registration-{year}`
- `schedule-{year}`
- `checkin-{year}`
- `user-{year}`

Fields consumed:

- registration totals and date-time breakdowns
- check-in date/hour counts and preregistration/on-site counts
- user zip/referrer distributions
- schedule slot counts

### `parameters/public`

Primary purpose:

- runtime feature gating shared with the public app

Fields used by the admin app:

- `admin.checkinEnabled`
- `admin.onsiteRegistrationEnabled`
- `admin.preRegistrationEnabled`
- `admin.allowCancelRegistration`
- `admin.allowChangeRegistration` exists in shared contract but no usage was found in `santashop-admin`

Feature-flag wiring found:

- `checkinEnabled$` disables admin check-in actions and nav
- `onsiteRegistrationEnabled$` disables on-site registration nav
- `preRegistrationEnabled$` disables preregistration nav
- `allowCancelRegistration$` controls the delete button in review

## Firebase operations called by the admin app

### Firebase Auth operations

| Operation | Triggered from | When it happens |
| --- | --- | --- |
| `signInWithEmailAndPassword` | `SignInPage.login()` | staff sign-in |
| `signOut` | `LandingPage.signOut()` | staff logout |
| token claim read (`getIdTokenResult`) | shared auth stack / route guard behavior | supports admin authorization checks |

### Callable functions directly invoked by the admin app

| Callable | Triggered from | Request shape at the interface | High-level effect |
| --- | --- | --- | --- |
| `callableAdminPreRegister` | `PreRegistrationPage.register()` | full admin-built `Registration` payload | creates auth account, user doc, submitted registration doc, search index doc, QR code, and queued email |
| `onSiteRegistration` | `RegistrationPage.checkIn()` | form-built `Registration` payload with placeholder ids | creates `onsiteregistrations/{id}` and `checkins/{id}` |
| `checkIn` | `ReviewPage.checkIn()` when unchanged | partial registration fields needed for check-in | creates `checkins/{uid}` |
| `checkInWithEdit` | `ReviewPage.checkIn()` when `wasEdited` | partial registration fields including edited children | creates `checkins/{uid}` and `editedregistrations/{uid}` |
| `changeRegistrationDateTime` | `ReviewPage.editDateTime()` | `{ newDateTimeSlot, registrationUid }` | updates submitted registration slot and requeues email |
| `undoRegistration` | `ReviewPage.cancelReservation()` | current registration object | deletes search index and clears submitted reservation state |
| `callableResendRegistrationEmail` | `ResendEmailPage.searchAndSend()` | `{ customerId }` | requeues email and resets reminder-email flags |

### Backend follow-on processes relevant to admin workflows

| Function / process | Trigger | Why the admin app cares |
| --- | --- | --- |
| `sendNewRegistrationEmails` | writes to `tmp_registrationemails/{uid}` | sends the queued emails created by preregistration, date changes, and manual resend |
| scheduled stats builders | cron/scheduler | populate the dashboards the admin stats pages read |
| slot counter job | cron/scheduler | keeps `slotsReserved` current for capacity displays and selection confidence |

## Shared context and gating behavior

### `CheckInContextService`

This service is the in-memory spine of the multi-step check-in flow.

It stores:

- current registration being processed
- check-in result payload `{ code, count }`

It also normalizes:

- child `dateOfBirth` timestamps → `Date`
- registration `dateTimeSlot.dateTime` timestamps → `Date`
- missing `dateTimeSlot` by falling back to `previousDateTimeSlot`

Why it matters:

- scan, review, and confirmation are loosely coupled via context rather than route params or persistent storage
- review edits are ephemeral until a callable finalizes them

### `SearchService`

This service stores a query observable rather than storing concrete results.

Why it matters:

- `ResultsPage` must unwrap an observable of an observable-like search state
- this keeps query setup simple but adds indirection to the flow

### `LookupService`

This service is the main Firestore read facade for:

- search index lookup
- registration-by-QR lookup
- registration-by-uid lookup
- check-in-by-uid lookup

Why it matters:

- the admin workflow is a two-step lookup architecture: find via index, then operate via canonical record

## Key operator-visible failure modes

| Scenario | Current behavior surface |
| --- | --- |
| wrong password / wrong email / lockout | sign-in alert with tailored header |
| QR scan not found | scan alert with option to go to search |
| duplicate preregistration email | client-side preregistration alert blocks submission |
| duplicate check-in | routes to duplicate page showing existing check-in record |
| date/time change callable failure | review alert on change-date action |
| resend email for incomplete or QR-unready registration | callable rejects; resend page shows error alert |
| check-in feature disabled | review screen disables check-in action |

## Simplification hotspots

### 1. Search state stores observables instead of results

Current state:

- `SearchService` stores `BehaviorSubject<Observable<RegistrationSearchIndex[]> | null>`
- `ResultsPage` has to unwrap and race it with a timeout

Why it matters:

- this is more complex than the operator need suggests
- a flatter `{ results, loading, error }` model would likely be easier to maintain

### 2. Context-only edits during review are transient until check-in

Current state:

- child edits in review are applied only to in-memory context
- the canonical registration is not updated directly
- persistence happens indirectly only if `checkInWithEdit` is used

Why it matters:

- review is part editor, part check-in workflow, part transient staging area
- this mixed responsibility may be confusing when designing future simplifications

### 3. Preregistration and on-site registration are parallel but different record lifecycles

Current state:

- preregistration creates auth + `users` + `registrations` + search index + email queue
- on-site registration creates `onsiteregistrations` + `checkins` only

Why it matters:

- both workflows feel similar in UI, but produce very different backend footprints
- later simplification may want a clearer unified intake model with explicit lifecycle states

### 4. Duplicate email preregistration check is split between client and backend

Current state:

- client checks `users` before calling preregistration callable
- backend also relies on auth/user creation failure protection

Why it matters:

- this is duplicated logic with a race window
- it is a candidate for consolidation into a single authoritative backend decision

### 5. Email-based `isAdmin$` helper is semantically misleading

Current state:

- `LandingPage` checks whether the email address string contains `admin`

Why it matters:

- it looks like an authorization signal but is not one
- future readers and maintainers could misinterpret it

### 6. Stats pages mix legacy and newer aggregates

Current state:

- registration stats still consume legacy `dateTimeCount` while also reading `schedule-{year}`
- model comments indicate old fields intended for removal long ago

Why it matters:

- reporting logic is carrying compatibility baggage
- simplification work should likely define one stable stats contract per dashboard

### 7. Hardcoded year defaults remain in multiple pages

Current state:

- several admin pages default to `2025`
- some slot loading is hardcoded to `2025` rather than using shared program-year config

Why it matters:

- season rollover behavior is brittle
- simplifying operational flows probably also means centralizing season/year configuration

### 8. Duplicate detection for on-site flow is awkward from the client’s point of view

Current state:

- on-site UI sends placeholder `uid: onsite`
- backend creates the real id
- duplicate handling in the UI still assumes a known uid path

Why it matters:

- error handling and operator recovery could be clearer if the backend returned explicit duplicate metadata

## Information requested / TBD

This pass is enough for future simplification analysis, but a few follow-up questions remain if you want a second admin-focused pass later:

- **TBD:** whether the `/admin/stats/*` routes are intentionally outside the `canActivate` admin shell or simply inherited by convention
- **TBD:** whether `LandingPage.isAdmin$` has any intended business meaning beyond a UI convenience check
- **TBD:** whether review-page edits should remain ephemeral or are meant to become canonical registration updates
- **TBD:** whether preregistration should continue to create fully submitted registrations immediately, or move toward a draft-like flow

---
<small>Generated with GitHub Copilot as directed by {USER_NAME_PLACEHOLDER}</small>
