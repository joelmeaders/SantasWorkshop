# Santashop current app architecture overview

## Scope

This document maps the current customer-facing `santashop-app` workflow and its supporting code paths so the team can later simplify the experience, data model, and backend interactions.

Scope for this pass:

- Public Ionic/Angular app in `santashop-app/`
- Shared contracts and wrappers used by the app in `santashop-core/` and `santashop-models/`
- Firebase callable functions and follow-on triggers in `santashop-functions/` that are part of the public-app journey

Out of scope for deep detail:

- Admin UI behavior except where it changes records the public app depends on
- Styling, translation copy, and low-level implementation details that do not materially change behavior
- Firestore security rules and deployment config details

## System boundary

The current app is a standalone Ionic/Angular client that uses Firebase as its backend platform.

High-level runtime dependencies:

- Firebase Auth for sign-in, password reset, password change, and identity
- Firestore for user profile, registration, slot availability, check-in state, and public parameters
- Cloud Functions for account creation and post-account mutations that need server authority
- Firebase Storage for the registration QR code image (`registrations/{uid}.png`)
- Firebase Analytics for user-flow event logging

## Codebase map

| Area | Main files | Why it matters |
| --- | --- | --- |
| Route tree | `santashop-app/src/app/app.routes.ts` | Defines the public workflow and the route-level guards |
| App bootstrap + global overlays | `santashop-app/src/app/app.component.ts`, `santashop-app/src/app/core/services/application.service.ts` | Applies startup language selection, global alerts, and maintenance/weather/registration-closed modals |
| Current-user registration state | `santashop-app/src/app/core/services/pre-registration.service.ts` | Central observable source for the logged-in user’s registration, children, slot, QR code, and completion state |
| Current-user profile state | `santashop-app/src/app/core/services/profile.service.ts` | Reads the `users/{uid}` profile record and exposes `referredBy` |
| Check-in lockout | `santashop-app/src/app/core/services/checkin.service.ts` | Observes `checkins/{uid}` and logs the user out after check-in |
| Shared Firebase wrappers | `santashop-core/src/lib/services/auth.service.ts`, `santashop-core/src/lib/services/_functions-wrapper.ts`, `santashop-core/src/lib/services/app-state.service.ts` | Encapsulates auth, callable functions, and `parameters/public` reads |
| Shared contracts | `santashop-models/src/lib/*.ts` | Defines record shapes used by app and functions |
| Backend mutations | `santashop-functions/src/index.ts`, `santashop-functions/src/fn/*.ts` | Implements callable functions that mutate auth and Firestore state |

## Route and page catalog

### Entry and account routes

| Route | Page | Purpose | Primary reads | Primary writes / calls | Gate |
| --- | --- | --- | --- | --- | --- |
| `/` | `HomePage` | Landing page with environment/version display, language toggle, and entry buttons | `AppStateService.createAccountEnabled$` | None | None |
| `/sign-in` | `SignInPage` | Existing-user login screen | `createAccountEnabled$` for showing sign-up affordance | Firebase Auth `login()` | Redirects logged-in users to `/pre-registration/overview` |
| `/sign-up` | `SignUpPage` | New-account form with legal acceptance and newsletter opt-in | `createAccountEnabled$` | Callable `newAccount`, then Firebase Auth `login()` | Auth guard redirects logged-in users to `/pre-registration/overview` |
| `/reset-password` | `ResetPasswordPage` | Password-reset email form | None | Firebase Auth `resetPassword()` | None |

### Pre-registration shell and child routes

| Route | Page | Purpose | Primary reads | Primary writes / calls | Gate |
| --- | --- | --- | --- | --- | --- |
| `/pre-registration` | `PreRegistrationPage` | Tab-shell/container that exposes shared registration state across child pages | `userRegistration$`, `childCount$`, `dateTimeSlot$`, `registrationComplete$`, `referredBy$` | None | Requires auth; child access also blocked by check-in state |
| `/pre-registration/overview` | `OverviewPage` | Progress dashboard that nudges the user through referral, children, schedule, and submit steps | registration summary, child count, slot, referral state | Referral flow can call `updateReferredBy` from `ReferralCardComponent` | Redirects submitted registrations to confirmation |
| `/pre-registration/children` | `ChildrenPage` | Lists registered children and allows delete/edit navigation | `children$`, `childCount$` | Direct Firestore update through `saveRegistration()` when deleting | Redirects submitted registrations to confirmation |
| `/pre-registration/children/add-child` | `AddChildPage` | Add a child to the registration | existing children for append | Direct Firestore update through `saveRegistration()` | Redirects submitted registrations to confirmation |
| `/pre-registration/children/add-child/:id` | `AddChildPage` | Edit an existing child in-place | existing children for load/replace | Direct Firestore update through `saveRegistration()` | Redirects submitted registrations to confirmation |
| `/pre-registration/date-time` | `DateTimePage` | Shows enabled slots for the current program year and lets the user pick one | `dateTimeSlots` query + current registration slot | Direct Firestore update through `saveRegistration()` | Redirects submitted registrations to confirmation |
| `/pre-registration/submit` | `SubmitPage` | Final review page before submission | children, slot, readiness | Callable `completeRegistration` | Requires a ready-to-submit registration |
| `/pre-registration/confirmation` | `ConfirmationPage` | Ticket/confirmation page after submit; shows QR code, event info, children, and change-slot action | submitted registration, QR code from Storage, feature flags | Callable `changeRegistrationDateTime`; dormant `undoRegistration()` method exists | Only accessible after submission |
| `/pre-registration/confirmation/event-information` | `EventInformationPage` | Event-info detail page reached from confirmation | None beyond static content | None | Only accessible after submission via parent |
| `/pre-registration/profile` | `ProfilePage` | Profile hub for name/zip, email, and password changes | `userProfile$`, registration-complete state | Profile child routes below | Auth + check-in shell |
| `/pre-registration/profile/change-info` | `ChangeInfoPage` | Edit first name, last name, and zip code | current `users/{uid}` | Callable `changeAccountInformation` | Auth + check-in shell |
| `/pre-registration/profile/change-email` | `ChangeEmailPage` | Change email address after password confirmation | current `users/{uid}` | Firebase Auth re-auth + callable `updateEmailAddress` | Auth + check-in shell |
| `/pre-registration/profile/change-password` | `ChangePasswordPage` | Change password after re-authentication | none beyond current auth user | Firebase Auth re-auth + `updatePassword()` | Auth + check-in shell |
| `/pre-registration/help` | `HelpPage` | Static support/help page inside the authenticated shell | registration-complete state | None | Auth + check-in shell |

### Global blocking routes / overlays

| Route or overlay | Page | Purpose | Driven by |
| --- | --- | --- | --- |
| `/registration-closed` and modal overlay | `RegistrationClosedPage` | Blocks the app when public registration is off | `parameters/public.registrationEnabled` |
| `/maintenance` and modal overlay | `MaintenancePage` | Blocks the app during maintenance | `parameters/public.maintenanceModeEnabled` |
| `/bad-weather` and modal overlay | `BadWeatherPage` | Blocks the app when the shop is weather-closed | `parameters/public.weatherModeEnabled` |

## Major workflow

```mermaid src="./diagrams/public-app-workflow.mmd" alt="Santashop public app workflow"```

### 1. App startup and global state

`AppComponent` and `ApplicationService` establish app-wide behavior before the user gets far into the flow:

- Picks browser language (`en` or `es`) and sets a fallback of `en`
- Logs a default-language analytics event
- Reads `parameters/public.globalAlert` and shows a one-time alert if `displayAlert` is true
- Continuously observes public parameters and shows blocking overlays with this precedence:
  1. maintenance mode
  2. weather closure
  3. registration closed

Why it matters:

- The app has a second, global workflow layered on top of the route workflow
- Feature toggles and closure states are runtime data, not build-time config

### 2. Landing and entry decision

From `HomePage`, the user sees the public landing page and chooses between:

- create account
- sign in
- view public-facing static content and social links

`createAccountEnabled$` governs whether the app encourages account creation. The same flag is checked on the home page, sign-in page, and sign-up page.

### 3. Sign-up flow

The sign-up form captures:

- `firstName`
- `lastName`
- `emailAddress`
- `password`
- `password2` (confirmation only; not persisted)
- `zipCode`
- `legal` (required checkbox; used to imply acceptance timestamps)
- `newsletter`

Flow:

1. User fills the form and confirms the typed email address.
2. `SignUpPageService.onboardUser()` calls callable function `newAccount`.
3. Backend creates the Firebase Auth user.
4. Backend creates `users/{uid}` and `registrations/{uid}`.
5. Backend generates a QR code image and stores it in Firebase Storage.
6. Front end immediately signs the user in with Firebase Auth.
7. User lands on `/pre-registration/overview`.

Observable user-visible failure mode:

- If the email already exists, the app shows an alert that offers either password reset or sign-in.

### 4. Sign-in flow

The sign-in form captures:

- `emailAddress`
- `password`

Flow:

1. `SignInPageService.signIn()` calls `AuthService.login()`.
2. Firebase Auth signs the user in.
3. Shared auth state emits the current user.
4. Route logic carries the user into the authenticated pre-registration shell.

### 5. Pre-registration shell behavior

Once signed in, nearly the whole app is driven by two continuously-read records:

- `registrations/{uid}` via `PreRegistrationService`
- `users/{uid}` via `ProfileService`

The shell uses guards to keep the user in the right stage:

- not signed in → `/sign-in`
- already submitted → `/pre-registration/confirmation`
- not ready to submit → `/pre-registration/overview`
- already checked in → blocked and eventually logged out

### 6. Referral flow on overview

`OverviewPage` contains `ReferralCardComponent`, which reads a curated agency list from `assets/referring-agencies.json` and lets the user select or type a referral source.

Flow:

1. User searches the agency list or chooses `Other`.
2. Component calls callable `updateReferredBy`.
3. Backend updates `users/{uid}.referredBy`.

Important current-state note:

- `referredBy` is written to `users/{uid}` only.
- It is not mirrored into `registrations/{uid}` by the current callable.

### 7. Children flow

`AddChildPage` captures one child at a time and writes the entire `children` array back into the registration record.

Child fields persisted into `registrations/{uid}.children[]`:

- `id` (random client-generated numeric identifier)
- `firstName`
- `lastName`
- `dateOfBirth`
- `ageGroup`
- `toyType`
- `programYearAdded`
- `enabled`
- optional `error` field may exist in the model, but validated saves remove it

Behavior:

- age is inferred from birthday and mapped to `0-2`, `3-5`, `6-8`, or `9-11`
- infant selection auto-sets `toyType = infants` and `ageGroup = 0-2`
- add, edit, and delete all work by replacing the full `children` array on `registrations/{uid}`

Why it matters:

- Child management is a client-side array-replacement pattern, not a child-subcollection pattern
- This is one of the biggest simplification levers because it mixes validation, derived fields, and direct persistence in the client

### 8. Date/time selection flow

`DateTimePageService` reads available slots from `dateTimeSlots` where:

- `programYear == current program year`
- `enabled == true`

When the user chooses a slot before submission, the client directly updates:

- `registrations/{uid}.dateTimeSlot.id`
- `registrations/{uid}.dateTimeSlot.dateTime`

The page also groups slots by day and shows remaining capacity using:

- `maxSlots`
- `slotsReserved`

Important current-state note:

- pre-submit slot changes are direct Firestore writes
- post-submit slot changes use a callable function instead

That split is one of the current architecture seams.

### 9. Submit flow

`SubmitPage` is only reachable when the registration has:

- at least one child
- a selected slot
- no existing `registrationSubmittedOn`

When the user submits:

1. Front end loads the current registration from `PreRegistrationService.userRegistration$`.
2. Front end calls callable `completeRegistration`.
3. Backend validates that the registration is complete and belongs to the caller.
4. Backend updates the main registration record.
5. Backend creates or upserts email-queue and search-index records.
6. Front end waits briefly, then navigates to confirmation.

Observable user-visible failure modes:

- incomplete registration → function rejects with failed precondition
- duplicate submission → function rejects as already submitted
- cold start or transient function error → client retries once before surfacing an error

### 10. Confirmation flow

`ConfirmationPage` is the post-submit “ticket” page.

It shows:

- QR code image from Storage (`registrations/{uid}.png`)
- event-information links
- what to bring / location copy
- submitted date/time
- children list
- conditional “change registration date/time” action

Current post-submit actions:

- **Active in UI:** change registration date/time
- **Implemented in TypeScript but not visibly wired in current template:** undo/cancel registration

That second bullet is important: `ConfirmationPage.undoRegistration()` exists and `PreRegistrationService.undoRegistration()` exists, but no current button was found in `confirmation.page.html`.

### 11. Post-submit slot-change flow

When the user changes their slot from confirmation:

1. UI checks `hasCheckedIn$`; if true, the action is blocked.
2. UI asks for confirmation.
3. UI opens `ChangeDatetimeModalComponent` with the current slot and available slots.
4. UI calls callable `changeRegistrationDateTime` with `newDateTimeSlot`.
5. Backend updates the registration and re-queues an email.
6. UI shows a success alert.

Observable user-visible failure modes:

- not yet submitted → backend rejects the change
- already checked in → UI blocks before call, backend also rejects if reached
- slot info missing in client → generic registration-load error alert

### 12. Check-in side effect

The public app never calls `checkIn` itself, but it is downstream from that admin action.

Flow:

1. Admin/back-office flow creates `checkins/{uid}`.
2. `CheckinService` in the public app continuously watches `checkins/{uid}`.
3. As soon as a check-in document exists, the app:
   - shows a “Merry Christmas” alert
   - signs the user out
   - reloads the browser

Why it matters:

- check-in is enforced indirectly by document observation, not route navigation alone
- the app becomes effectively single-season / single-session after event check-in

## Data contracts and record mutations

```mermaid src="./diagrams/data-and-function-flow.mmd" alt="Santashop public app data and function flow"```

### `users/{uid}`

Primary purpose:

- profile and account metadata for the signed-in shopper

Key fields used by the public app:

- `firstName`
- `lastName`
- `emailAddress`
- `zipCode`
- `acceptedTermsOfService`
- `acceptedPrivacyPolicy`
- `version`
- `manuallyMigrated`
- `newsletter`
- `referredBy` (optional)

Fields added or updated by workflow stage:

| When | Mutation source | Fields added or changed |
| --- | --- | --- |
| account creation | callable `newAccount` | `firstName`, `lastName`, `emailAddress`, `zipCode`, `acceptedTermsOfService`, `acceptedPrivacyPolicy`, `version`, `manuallyMigrated`, `newsletter` |
| referral saved | callable `updateReferredBy` | `referredBy` |
| profile info changed | callable `changeAccountInformation` | `firstName`, `lastName`, `zipCode` |
| email changed | callable `updateEmailAddress` | `emailAddress` |

### `registrations/{uid}`

Primary purpose:

- source-of-truth registration document for the public user journey

Key fields used by the public app and functions:

- `uid`
- `firstName`
- `lastName`
- `emailAddress`
- `zipCode`
- `qrcode`
- `children[]`
- `dateTimeSlot`
- `previousDateTimeSlot`
- `registrationSubmittedOn`
- `includedInCounts`
- `includedInRegistrationStats`
- `programYear`
- `reminderEmailQueuedOn`
- `reminderEmailFailedOn`
- `reminderEmailSentOn`
- `qrCodeGeneratedOn`
- `qrCodeGenerationFailedOn`
- `hasCheckedIn`

Fields added or updated by workflow stage:

| When | Mutation source | Fields added or changed |
| --- | --- | --- |
| account creation | callable `newAccount` | `uid`, `firstName`, `lastName`, `emailAddress`, `zipCode`, `qrcode`, `qrCodeGeneratedOn = false` |
| QR code finalized | callable `newAccount` follow-up | `qrCodeGeneratedOn = Date`, `qrCodeGenerationFailedOn = false` |
| add/edit/delete child | direct client write via `saveRegistration()` | replaces `children[]` |
| choose slot pre-submit | direct client write via `saveRegistration()` | `dateTimeSlot.id`, `dateTimeSlot.dateTime` |
| submit registration | callable `completeRegistration` | `registrationSubmittedOn = Date`, `includedInCounts = false`, `includedInRegistrationStats = false`, `programYear` |
| change profile info | callable `changeAccountInformation` | `firstName`, `lastName`, `zipCode` |
| change email | callable `updateEmailAddress` | `emailAddress` |
| change slot post-submit | callable `changeRegistrationDateTime` | `previousDateTimeSlot`, `dateTimeSlot`, `includedInCounts = false`, `reminderEmailSentOn = false`, `reminderEmailFailedOn = false` |
| undo/cancel registration | callable `undoRegistration` | copies old slot into `previousDateTimeSlot`, removes `dateTimeSlot`, removes `registrationSubmittedOn`, sets `includedInCounts = false` |
| admin/event check-in side effects | admin/background flows | eventually `hasCheckedIn` becomes relevant to the public app |

### `registrations/{uid}.children[]`

The app does not create child documents in a separate collection. It stores all children inline on the registration document.

Each child entry is shaped like:

- `id`: client-generated random integer
- `firstName`
- `lastName`
- `dateOfBirth`
- `ageGroup`
- `toyType`
- `programYearAdded`
- `enabled`

Why it matters:

- every child edit rewrites the whole array
- child data, slot data, and submission state all live in one Firestore document

### `dateTimeSlots/{id}`

Primary purpose:

- admin-managed available appointment windows for the current season

Key fields read by the public app:

- `programYear`
- `dateTime`
- `maxSlots`
- `slotsReserved`
- `enabled`
- `lastUpdated`

Public-app behavior:

- reads enabled slots for the active program year
- never writes these documents directly
- uses them to populate both the pre-submit chooser and the post-submit change-slot modal

### `registrationsearchindex/{uid}`

Primary purpose:

- denormalized admin-search document built from registration/profile data

Fields written by public-app-driven functions:

- `code`
- `customerId`
- `firstName` (lowercase)
- `lastName` (lowercase)
- `emailAddress` (lowercase)
- `zip`

Fields added or updated by workflow stage:

| When | Mutation source | Fields added or changed |
| --- | --- | --- |
| submit registration | callable `completeRegistration` | full index document create/upsert |
| profile info changed | callable `changeAccountInformation` | `firstName`, `lastName`, `zip` |
| email changed | callable `updateEmailAddress` | `emailAddress` |
| undo/cancel registration | callable `undoRegistration` | document deleted |

### `tmp_registrationemails/{uid}`

Primary purpose:

- queue document that triggers registration email delivery

Fields written by public-app-driven functions:

- on submit, `completeRegistration` writes:
  - `code`
  - `email`
  - `name`
  - `formattedDateTime`
- on post-submit slot change, `changeRegistrationDateTime` additionally writes/overwrites:
  - `queuedOn`
  - `queueSource = date-time-change`
  - `deliveryRequestedOn`
  - `deliveryState = queued`
  - `failedOn = false`
  - `lastErrorMessage = false`
  - `lastErrorDetails = false`

Downstream effect:

- `sendNewRegistrationEmails` is triggered by writes to `tmp_registrationemails/{docId}`

### `checkins/{uid}`

Primary purpose:

- indicates the user has checked in at the event and carries aggregate stats for admin/reporting use

Fields created by admin-initiated check-in functions:

- `checkInDateTime`
- `customerId`
- `inStats`
- `registrationCode`
- `stats`

Public-app effect:

- the existence of `checkins/{uid}` is enough to lock the user out of the active registration flow and log them out

### `parameters/public`

Primary purpose:

- runtime feature flags and public notices

Fields consumed by the public app:

- `registrationEnabled`
- `maintenanceModeEnabled`
- `weatherModeEnabled`
- `createAccountEnabled`
- `messageEn`
- `messageEs`
- `admin.checkinEnabled`
- `admin.onsiteRegistrationEnabled`
- `admin.preRegistrationEnabled`
- `admin.allowCancelRegistration`
- `admin.allowChangeRegistration`
- `globalAlert.displayAlert`
- `globalAlert.titleEn`
- `globalAlert.titleEs`
- `globalAlert.messageEn`
- `globalAlert.messageEs`

Important current-state note:

- `allowChangeRegistration` is wired into `ConfirmationPage`
- `allowCancelRegistration` exists in the shared contract, but no usage was found in `santashop-app`

### Storage object: `registrations/{uid}.png`

Primary purpose:

- QR-code image shown on the confirmation page

Lifecycle:

- generated during `newAccount`
- read later via `QrCodeService.registrationQrCodeUrl(uid)`

## Firebase operations called by the app

### Firebase Auth operations

| Operation | Triggered from | When it happens |
| --- | --- | --- |
| `signInWithEmailAndPassword` | `SignInPageService.signIn()` and sign-up auto-login | Existing-user sign-in and immediate post-account-creation login |
| `sendPasswordResetEmail` | `ResetPasswordPage.resetPassword()` | User requests password reset |
| `updatePassword` | `AuthService.changePassword()` | User changes password from profile |
| `signOut` | `AuthService.logout()` via `CheckinService` or explicit logout flows elsewhere | User is signed out after check-in or manual logout |
| token claim read (`getIdTokenResult`) | `AuthService.isAdmin$` | Shared admin detection, primarily for guarded/admin-aware behavior |

### Callable functions directly invoked by the public app

| Callable | Triggered from | Request shape at the interface | High-level effect |
| --- | --- | --- | --- |
| `newAccount` | `SignUpPageService.onboardUser()` | onboarding fields from sign-up form | Creates auth user, user doc, registration doc, QR code |
| `updateReferredBy` | `ReferralCardComponent.submit()` | `{ referredBy }` | Updates `users/{uid}.referredBy` |
| `completeRegistration` | `SubmitPageService.submitRegistration()` | current `Registration` object | Marks registration submitted, creates search index, queues email |
| `changeRegistrationDateTime` | `ConfirmationPage.changeRegistration()` | `{ newDateTimeSlot, registrationUid? }` | Moves submitted registration to a new slot and queues another email |
| `changeAccountInformation` | `ProfilePageService.updatePublicProfile()` | `{ firstName, lastName, zipCode }` | Updates auth display name, `users`, `registrations`, and search index |
| `updateEmailAddress` | `AuthService.changeEmailAddress()` | `{ emailAddress }` | Updates auth email plus mirrored Firestore email fields |
| `undoRegistration` | `PreRegistrationService.undoRegistration()` / dormant confirmation method | current-user undo request | Clears submission state and removes search index |

### Backend follow-on functions that matter to the app flow

These are not called directly by the public app, but they are part of the effective workflow:

| Function | Trigger | Why the app cares |
| --- | --- | --- |
| `sendNewRegistrationEmails` | Firestore write to `tmp_registrationemails/{docId}` | Sends or retries registration emails after submit and slot changes |
| `scheduledDateTimeSlotCounters` | scheduled job | Keeps slot-capacity counters current for the date/time chooser |
| `scheduledRegistrationStats` | scheduled job | Consumes submitted registrations for reporting |
| `scheduledUserStats` | scheduled job | Consumes user/profile data for reporting |
| `scheduledCheckInStats` | scheduled job | Consumes check-in data for reporting |
| `pubsubMarkRegistrationsCheckedIn` | Pub/Sub | Contributes to the `hasCheckedIn`/check-in lifecycle reflected back to the app |

## Guard and gating behavior

| Guard or gate | Decision source | Result |
| --- | --- | --- |
| Auth guard | Firebase auth state | Unauthenticated users are sent to `/sign-in` |
| `CheckedInGuard` | `checkins/{uid}` existence via `CheckinService` | Blocks authenticated registration routes after check-in |
| `RegistrationCompleteGuard` | `registrationComplete$` | Keeps submitted users out of overview/children/date-time/submit and pushes them to confirmation |
| `RegistrationIncompleteGuard` | `registrationComplete$` | Prevents unsubmitted users from entering confirmation |
| `RegistrationReadyToSubmitGuard` | `registrationReadyToSubmit$` | Prevents entering submit until children and slot exist |
| `createAccountEnabled` | `parameters/public` | Controls whether sign-up affordances are shown |
| maintenance/weather/registration flags | `parameters/public` | Hard-stop overlays that can supersede the route flow |

## Key user-visible failure modes

| Scenario | Current behavior surface |
| --- | --- |
| account email already exists | sign-up alert offers password reset or sign-in |
| child age invalid | add/edit child alert blocks save |
| registration not ready | route guard returns user to overview |
| registration already submitted | confirmation becomes the canonical destination |
| change slot after check-in | UI blocks action and backend also rejects it if reached |
| check-in exists | app shows a final alert, signs the user out, and reloads |
| global closure flag flips | app displays blocking modal without route changes |

## Simplification hotspots

These are the highest-value simplification targets surfaced by the current architecture.

### 1. Direct Firestore writes before submit, callable functions after submit

Current state:

- children and pre-submit slot changes write directly to `registrations/{uid}` from the client
- submit, profile, email, and post-submit slot changes go through callable functions

Why it matters:

- validation and mutation rules are split across client and backend
- later simplification work will likely be easier if registration mutation goes through a single boundary

### 2. One large registration document carries many concerns

`registrations/{uid}` currently mixes:

- account snapshot fields
- child list
- chosen appointment
- QR-code metadata
- email-queue flags
- reporting flags
- check-in state

Why it matters:

- almost every step rewrites the same record
- lifecycle phases are encoded as field presence/absence rather than explicit state transitions

### 3. Cancel/undo path is only partially surfaced

Current state:

- callable `undoRegistration` exists
- `ConfirmationPage.undoRegistration()` exists
- no visible button was found in the current confirmation template
- `admin.allowCancelRegistration` exists in shared config but is not wired in the public app

Why it matters:

- behavior and configuration drift appear to have started
- this is a strong candidate for cleanup before future simplification work

### 4. Referral data is captured late and stored only on the user record

Current state:

- referral is optional and separate from sign-up
- it writes only `users/{uid}.referredBy`

Why it matters:

- analytics/marketing intent is split away from the registration submission event
- if referral should be part of the core funnel, the current placement is fragile

### 5. Date handling is spread across client and backend

Current state:

- add-child form converts `yyyy-mm-dd` strings into `Date`
- registration service converts Firestore timestamps back into `Date`
- slot-change callable normalizes incoming date/time values

Why it matters:

- there are multiple conversion boundaries for the same concepts
- later simplification should likely define one canonical transport format per field type

### 6. Check-in lockout is effective but abrupt

Current state:

- as soon as `checkins/{uid}` exists, the app alerts, logs out, and reloads

Why it matters:

- this is operationally simple, but it creates a jarring user experience and hides the transition behind a document observer

## Information requested / TBD

The current pass is sufficient for workflow simplification analysis, but a few lower-level questions remain if you want a second documentation pass later:

- **TBD:** Firestore security-rule intent for the direct client writes to `registrations/{uid}` before submit
- **TBD:** Exact background path that sets or mirrors `registrations/{uid}.hasCheckedIn` in every environment
- **TBD:** Whether undo/cancel registration is intentionally hidden or accidentally orphaned in the current UI
- **TBD:** Whether referral is intentionally user-profile data only, or meant to influence reporting at registration time

---
<small>Generated with GitHub Copilot as directed by {USER_NAME_PLACEHOLDER}</small>
