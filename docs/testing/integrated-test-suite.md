# Integrated test suite

## Purpose

This document turns the business, functional, and non-functional requirements
into an emulator-backed integrated test suite. Tests are grouped by user-facing
feature so that a failure points to a business capability rather than an
implementation layer.

The executable baseline lives in `santashop-e2e/tests/`. Scenarios marked
**Automated** must pass in the normal e2e command. Scenarios marked **Planned**
remain part of the acceptance suite, but are not added as failing or skipped
Playwright tests until the corresponding workflow and deterministic emulator
setup exist.

## Test environment and execution policy

- Run the public and admin applications against the `demo-santashop` Firebase
  Auth, Firestore, Functions, and Storage emulators.
- Use the dedicated e2e Firestore port `8180` so the suite does not depend on
  the ordinary local-development port `8080` being free.
- Generate the app/admin `e2e` configuration and Functions `local`
  configuration before running.
- Clear emulator data before each scenario and seed only the state required by
  that scenario.
- Run sequentially because the tests share mutable emulator state.
- Run the complete suite in Chromium using the Pixel 5 mobile device profile,
  repeat public flows in Desktop Chrome, and run focused Desktop Chrome staff
  coverage. Repeat critical compatibility journeys in Desktop Firefox, iPhone
  WebKit, and iPad WebKit.
- Exercise customer or staff behavior through the UI. Emulator-only callables
  may arrange prerequisite state and inspect durable results, but must not
  replace the interaction under test.
- Do not wait for `networkidle`; Firebase listeners intentionally remain open.
- Treat public and admin specs as separate runs because both applications use
  port `4100`.

## Coverage status

| Status             | Meaning                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Automated          | Implemented in Playwright and expected to pass                                               |
| Planned            | Required scenario; blocked by missing workflow, stable test seam, or acceptance detail       |
| Other layer        | Better verified by Functions integration, rules, security, performance, or operational tests |
| Manual + automated | Requires automated checks plus human accessibility or operational review                     |

## Feature 1: Public entry, language, and operating controls

| Test ID | Scenario and expected result                                                                                                           | Requirements                                                             | Status    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------- |
| PUB-001 | Open the public entry page; create-account and existing-account routes are visible when registration and account creation are enabled. | BR-018; FR-CUS-001; NFR-UX-001                                           | Automated |
| PUB-002 | Toggle the public language from English to Spanish; primary entry copy changes without a rebuild.                                      | BR-013; FR-CUS-002–003; NFR-UX-002                                       | Automated |
| PUB-003 | Disable account creation at runtime; account creation is hidden from sign-in and direct sign-up cannot submit.                         | BR-001, BR-012; FR-SH-007; FR-CUS-004                                    | Automated |
| PUB-004 | Close registration at runtime; the public experience immediately shows the registration-closed state.                                  | BR-001, BR-005, BR-012; FR-SH-006, FR-SH-008; FR-SH-034; NFR-AVL-001–002 | Automated |
| PUB-005 | Enable maintenance mode; the public experience shows the maintenance state.                                                            | BR-005, BR-012; FR-SH-008; FR-SH-034; NFR-AVL-001–002                    | Automated |
| PUB-006 | Enable weather closure; the public experience shows the weather state.                                                                 | BR-005, BR-012; FR-SH-008; FR-SH-034; NFR-AVL-001–002                    | Automated |
| PUB-007 | Seed a bilingual global alert; the English notice appears and can be dismissed.                                                        | BR-012–013; FR-SH-010; NFR-UX-004                                        | Automated |
| PUB-008 | Change the global alert while a session is open; the updated notice becomes visible without rebuilding or redeploying.                 | BR-012; FR-SH-010; FR-SH-034                                             | Automated |

## Feature 2: Customer account and session access

| Test ID  | Scenario and expected result                                                                                                 | Requirements                                                              | Status      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------- |
| AUTH-001 | Create an account with valid identity/contact data and policy acceptance; the user is authenticated and enters registration. | BR-002, BR-019; FR-SH-001, FR-SH-011–012; FR-CUS-005–006; NFR-PRV-002–003 | Automated   |
| AUTH-002 | Leave required fields or policy acceptance incomplete; account submission remains unavailable.                               | FR-CUS-005; NFR-UX-005                                                    | Automated   |
| AUTH-003 | Attempt to create a second account with the same email; a recoverable duplicate-account message appears.                     | BR-053; FR-CUS-007; FR-SH-029, FR-SH-041; NFR-SEC-011; NFR-UX-005         | Automated   |
| AUTH-004 | Sign out and sign back in with the created credentials; registration continuity is preserved.                                | BR-019, BR-029; FR-CUS-008; NFR-DAT-001                                   | Automated   |
| AUTH-005 | Sign out, then navigate directly to a private registration route; the user is redirected to sign-in.                         | BR-010; FR-SH-004; NFR-SEC-001                                            | Automated   |
| AUTH-006 | While authenticated, open sign-in or sign-up; the user is redirected to the active registration overview.                    | FR-CUS-009                                                                | Automated   |
| AUTH-007 | Request password recovery for an account; the UI confirms that the reset request was accepted by the Auth emulator.          | BR-029; FR-CUS-010                                                        | Automated   |
| AUTH-008 | Use wrong credentials; the user remains signed out and receives a clear recovery message.                                    | FR-CUS-008; NFR-UX-004–005                                                | Automated   |
| AUTH-009 | Customer A attempts to read or mutate customer B data through the service boundary; access is denied.                        | BR-010; NFR-SEC-003, NFR-SEC-005                                          | Other layer |
| AUTH-010 | Externally exposed mutation endpoints reject missing anti-abuse proof outside the emulator while remaining testable locally. | BR-053; NFR-SEC-004, NFR-OPS-006                                          | Other layer |

## Feature 3: Registration overview, referral, and readiness

| Test ID | Scenario and expected result                                                                                         | Requirements                                                | Status    |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------- |
| REG-001 | A new account must choose a referral source before the main registration overview becomes available.                 | BR-021, BR-047; FR-CUS-017–020                              | Automated |
| REG-002 | Select a listed referral source; it persists and the overview shows child, schedule, and submission progress.        | FR-CUS-011–012, FR-CUS-017–020; NFR-DAT-001                 | Automated |
| REG-003 | Select “Other,” enter a value, and save; the alternate referral is accepted for reporting.                           | BR-021, BR-047; FR-CUS-019–020                              | Automated |
| REG-004 | Direct navigation to final submission before required registration data exists returns the customer to the overview. | BR-024; FR-CUS-015, FR-CUS-033, FR-CUS-053–054; NFR-DAT-007 | Automated |
| REG-005 | A submitted registration cannot return to draft management routes.                                                   | FR-CUS-014; NFR-MNT-004                                     | Automated |
| REG-006 | A checked-in customer is notified, signed out, and cannot continue self-service registration for that season.        | BR-027; FR-CUS-013, FR-CUS-050–051; NFR-MNT-004             | Automated |

## Feature 4: Child management and eligibility

| Test ID   | Scenario and expected result                                                                                                   | Requirements                                                    | Status      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------- |
| CHILD-001 | Add an eligible child with required identity, birth date, and toy preference; the child appears in the household registration. | BR-022, BR-048; FR-SH-013; FR-CUS-021–022, FR-CUS-025–027       | Automated   |
| CHILD-002 | Edit the child; the updated value replaces the prior value and remains associated with the registration.                       | BR-022; FR-CUS-023, FR-CUS-027                                  | Automated   |
| CHILD-003 | Remove the child and confirm the destructive prompt; the child is removed before submission.                                   | BR-022; FR-CUS-024                                              | Automated   |
| CHILD-004 | Enter an ineligible birth date or malformed child data; the form/function blocks persistence and explains the problem.         | BR-024, BR-048; FR-CUS-026; FR-SH-030; NFR-DAT-005, NFR-DAT-007 | Automated   |
| CHILD-005 | Submit a crafted invalid child payload outside the UI; the authoritative service boundary rejects it.                          | NFR-SEC-010; NFR-DAT-002, NFR-DAT-005                           | Other layer |

## Feature 5: Appointment selection and capacity

| Test ID  | Scenario and expected result                                                                                                           | Requirements                                                      | Status    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------- |
| APPT-001 | With an eligible child present, list only enabled appointment slots for the active program year and show comparable capacity.          | BR-011, BR-023; FR-SH-014, FR-SH-017; FR-CUS-028–029; NFR-DAT-003 | Automated |
| APPT-002 | Select one appointment; the selection persists on the overview and enables final review.                                               | BR-020, BR-023–024; FR-CUS-030–031; NFR-DAT-006                   | Automated |
| APPT-003 | Change a draft appointment and confirm the warning; the registration retains the new selection.                                        | FR-SH-018; NFR-REL-003                                            | Automated |
| APPT-004 | Two customers reserve near capacity; availability remains accurate as practical without requiring a waitlist or hard overbooking stop. | BR-046; FR-SH-027, FR-SH-042; NFR-PER-008                         | Planned   |

## Feature 6: Submission, confirmation, and post-submission changes

| Test ID | Scenario and expected result                                                                                                               | Requirements                                                       | Status      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------- |
| SUB-001 | Review a valid child and appointment, submit, and land on confirmation.                                                                    | BR-002, BR-024; FR-CUS-032–034; NFR-DAT-002, NFR-DAT-006           | Automated   |
| SUB-002 | Confirmation shows a QR artifact, reservation details, child details, and event-information navigation.                                    | BR-025; FR-SH-019; FR-CUS-037–038; NFR-DAT-001                     | Automated   |
| SUB-003 | Submission creates the staff search index and queues confirmation communication without blocking the customer workflow.                    | BR-006, BR-014–016; FR-CUS-035–036; FR-SH-020; NFR-REL-001–002     | Other layer |
| SUB-004 | A submitted customer attempting draft/submit routes is redirected to confirmation.                                                         | FR-CUS-014; NFR-MNT-004                                            | Automated   |
| SUB-005 | Change a submitted appointment when the control is enabled; retain prior context and queue follow-up communication.                        | BR-026; FR-CUS-039, FR-CUS-041–042; NFR-REL-003                    | Automated   |
| SUB-006 | After check-in, appointment change is rejected at both UI and service boundaries.                                                          | FR-CUS-040; FR-SH-031; NFR-DAT-002                                 | Automated   |
| SUB-007 | Customer cancellation records a cancellation log, queues cancellation communication, and invalidates/replaces the confirmation identifier. | BR-043–045; FR-CUS-043, FR-CUS-052; FR-SH-038–039; NFR-DAT-009–010 | Automated   |
| SUB-008 | A transient communication failure records failure/retry state and produces an in-app customer notice without corrupting registration.      | BR-050; FR-SH-022, FR-SH-035–037; NFR-REL-010–013                  | Planned     |

## Feature 7: Profile and help

| Test ID     | Scenario and expected result                                                                               | Requirements                                             | Status  |
| ----------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------- |
| PROFILE-001 | Open the authenticated profile and help areas from mobile navigation.                                      | FR-CUS-011, FR-CUS-044, FR-CUS-049                       | Automated |
| PROFILE-002 | Change core profile information; the customer registration and staff-searchable identity stay aligned.     | BR-028; FR-CUS-045, FR-CUS-048; NFR-DAT-001, NFR-DAT-008 | Automated |
| PROFILE-003 | Change email only after identity verification; the new email signs in and the old email does not.          | FR-CUS-046; NFR-SEC-005                                  | Automated |
| PROFILE-004 | Change password only after identity verification; the new password signs in and the old password does not. | FR-CUS-047; NFR-SEC-005                                  | Automated |

## Feature 8: Staff identity, authorization, and navigation

| Test ID   | Scenario and expected result                                                                                 | Requirements                                                       | Status      |
| --------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------- |
| STAFF-001 | An unauthenticated browser attempting an operational route is redirected to staff sign-in.                   | BR-010, BR-030; FR-SH-002–005; FR-OPS-001; NFR-SEC-002             | Automated   |
| STAFF-002 | A seeded authorized admin signs in and reaches the operational landing page.                                 | FR-OPS-001–003                                                     | Automated   |
| STAFF-003 | A customer/non-privileged account cannot enter the operational workspace.                                    | BR-010, BR-030; FR-SH-003, FR-SH-005; NFR-SEC-002–003, NFR-SEC-008 | Automated   |
| STAFF-004 | Staff signs out and protected operational routes are blocked afterward.                                      | FR-OPS-005                                                         | Automated   |
| STAFF-005 | Runtime controls disable check-in, on-site registration, preregistration, or cancellation without a rebuild. | BR-039; FR-SH-009; FR-OPS-004; NFR-MNT-003, NFR-MNT-006            | Automated   |
| STAFF-006 | A limited operator can register/check in but cannot access reporting/admin tools; an admin can.              | FR-OPS-041; NFR-SEC-012                                            | Automated   |
| STAFF-007 | A check-in-only operator cannot see or route to scan-risk review.                                             | FR-OPS-041; NFR-SEC-012                                            | Automated   |
| OWNER-001 | An ordinary administrator cannot access owner-only operations.                                                | NFR-SEC-012                                                       | Automated   |
| RULES-001 | Direct client access to owner-operation records is denied.                                                    | NFR-SEC-012                                                       | Automated   |
| RULES-002 | Admins can read scan audits; check-in-only staff cannot, and no client can create, update, or delete them.  | NFR-SEC-012                                                       | Automated   |

## Feature 9: Schedule and capacity administration

| Test ID   | Scenario and expected result                                                                        | Requirements                                                       | Status      |
| --------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------- |
| SCHED-001 | Generate schedule slots for a configured date range.                                                | BR-001, BR-011, BR-040–041; FR-SH-014, FR-SH-027; NFR-SEAS-001–002 | Automated   |
| SCHED-002 | Inline-edit a slot capacity and apply it to selected rows.                                          | FR-SH-027                                                          | Automated   |
| SCHED-003 | Edit a schedule date/time and persist it across reload.                                             | FR-SH-014, FR-SH-027                                               | Automated   |
| SCHED-004 | Capacity indicators show reserved/max values and disabled slots are visibly unavailable.            | FR-SH-027; NFR-UX-004                                              | Automated   |
| SCHED-005 | Enable a disabled slot at runtime.                                                                  | BR-001, BR-012; FR-SH-006, FR-SH-014                               | Automated   |
| SCHED-006 | Delete a schedule row after confirmation.                                                           | BR-040; FR-SH-014                                                  | Automated   |
| SCHED-007 | Re-run recurring slot availability work safely and complete within one minute under peak-size data. | NFR-REL-009; NFR-PER-004, NFR-PER-009                              | Other layer |

## Feature 10: Staff lookup and event-day check-in

| Test ID     | Scenario and expected result                                                                                      | Requirements                                           | Status      |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------- |
| CHECKIN-001 | Find a submitted registration by guardian name and ZIP.                                                           | BR-007, BR-015, BR-031; FR-OPS-006–007, FR-OPS-010–011 | Automated   |
| CHECKIN-002 | Find the same registration by email.                                                                              | FR-OPS-008                                             | Automated   |
| CHECKIN-003 | Find the same registration by confirmation code.                                                                  | FR-OPS-009                                             | Automated   |
| CHECKIN-004 | An unknown manual code cannot continue to check-in and offers alternate lookup recovery.                          | FR-OPS-012–014; FR-SH-033; NFR-REL-004, NFR-AVL-003    | Automated   |
| CHECKIN-INCOMPLETE-001 | An incomplete manual-code match cannot continue to check-in and offers alternate lookup recovery.       | FR-OPS-012–014; FR-SH-033; NFR-REL-004, NFR-AVL-003    | Automated   |
| CHECKIN-005 | Review registration, child, and appointment data, then check in without edits.                                    | BR-004, BR-032; FR-OPS-015–020; NFR-DAT-001–002        | Automated   |
| CHECKIN-006 | Change an appointment during review and complete a modified check-in.                                             | BR-033; FR-OPS-018, FR-OPS-021–022                     | Automated   |
| CHECKIN-007A | A likely accidental duplicate is blocked with current/prior context, no-coupon instruction, and restart.        | BR-034; FR-OPS-024–025; FR-SH-032; NFR-REL-005         | Automated   |
| CHECKIN-007B | A late duplicate is blocked and appears in scan-risk review with its timeline.                                   | BR-034; FR-OPS-024–025; FR-SH-032; NFR-REL-005         | Automated   |
| CHECKIN-007C | A superseded code stays blocked; a resubmitted replacement checks in once, then a later duplicate is blocked.    | BR-034; FR-OPS-024–025; FR-SH-032; NFR-REL-005         | Automated   |
| CHECKIN-010 | A valid manually entered registration code completes check-in.                                                   | FR-OPS-012–020                                                    | Automated   |
| CHECKIN-011 | Staff cancels a submitted registration from review and its superseded code is blocked.                           | BR-040; FR-SH-014; FR-OPS-018                                 | Automated   |
| CHECKIN-009 | Measure representative lookup/check-in completion time under peak-size seeded data.                               | FR-OPS-011; NFR-PER-001, NFR-PER-005                   | Other layer |

## Feature 11: Staff-assisted intake and communication support

| Test ID    | Scenario and expected result                                                                               | Requirements                      | Status  |
| ---------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- | ------- |
| ADMIN-PRE-001 | Staff preregisters a customer with identity, child, referral, and appointment data.                      | BR-003, BR-035; FR-OPS-026–027    | Automated |
| INTAKE-002 | Staff preregistration detects a duplicate account and offers a safe recovery path.                         | FR-OPS-028; NFR-SEC-011           | Planned |
| INTAKE-003 | Completed preregistration creates confirmation and support artifacts.                                      | FR-OPS-029                        | Planned |
| ADMIN-REG-001 | Staff registers and immediately checks in a walk-in without requiring a customer self-service account.   | BR-036; FR-OPS-030–033            | Automated |
| EMAIL-001  | Authorized staff can open the email-template manager and begin a new SES-ready draft.                        | FR-SH-022–023; FR-OPS-034–035    | Automated |
| USER-001   | An owner can create a check-in staff account through user management.                                         | FR-OPS-041; NFR-SEC-012            | Automated |
| COMMS-001  | Staff locates an eligible registration and requeues confirmation communication.                            | BR-037; FR-SH-023; FR-OPS-034–035 | Automated |

## Feature 12: Reporting, seasonal isolation, and data lifecycle

| Test ID    | Scenario and expected result                                                                                                                          | Requirements                                                       | Status      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------- |
| REPORT-001 | Authorized reporting users see registration and appointment utilization for a selected program year.                                                  | BR-008, BR-038; FR-SH-024, FR-SH-027; FR-OPS-036, FR-OPS-039–040   | Automated   |
| REPORT-002 | Authorized reporting users see check-in statistics by program year.                                                                                   | FR-SH-026; FR-OPS-037, FR-OPS-039–040                              | Automated   |
| REPORT-003 | Authorized reporting users see user, referral, and geographic statistics by program year.                                                             | BR-021, BR-047; FR-SH-025; FR-OPS-038–040                          | Automated   |
| REPORT-004 | Current-year registration, schedule, lookup, and reports do not mix records from another program year.                                                | BR-009, BR-011; FR-SH-017; NFR-DAT-003; NFR-SEAS-001, NFR-SEAS-003 | Automated   |
| REPORT-ENTRY-001 | Authorized staff can open registration, check-in, and user reporting views with safe empty states.                                             | FR-OPS-036–040; NFR-UX-004                                      | Automated   |
| SCAN-RISK-001 | Current-season scan-risk summaries paginate past 20 customers, keep prior-year data out, and show newest-first timelines.                       | NFR-DAT-003; NFR-SEAS-001, NFR-SEAS-003                          | Automated   |
| OWNER-002 | Exact phrase plus owner reauthentication starts safe repair work and shows in-progress then succeeded status.                                   | NFR-SEC-012                                                       | Automated   |
| OWNER-003 | An owner previews each listed safe operation and sees its exact confirmation phrase.                                                               | NFR-SEC-012                                                       | Automated   |
| OWNER-004 | A mistyped owner-operation phrase is rejected before an operation starts.                                                                           | NFR-SEC-012                                                       | Automated   |
| LIFE-001   | End-of-year operation backs up database content and stored files before purging customer, registration, and check-in data while retaining statistics. | BR-049; FR-SH-040; NFR-PRV-008–009; NFR-SEAS-004–005               | Other layer |
| LIFE-002   | Event-period backups run daily, retain 30 days, produce zip archives, and restore successfully using the documented process.                          | NFR-REL-007, NFR-REL-014–017                                       | Other layer |
| LIFE-003   | Exports containing personal contact data are audit logged and password protected.                                                                     | NFR-OPS-010–011                                                    | Other layer |

## Feature 13: Cross-cutting quality

| Test ID  | Scenario and expected result                                                                                                           | Requirements                                               | Status             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------ |
| QUAL-001 | Run automated accessibility analysis on critical public and staff routes at the mobile viewport with no serious/critical findings.      | BR-052; NFR-UX-003                                         | Automated          |
| QUAL-002 | Perform keyboard, screen-reader, zoom/reflow, contrast, error-identification, and focus-order review against WCAG AA.                  | BR-052; NFR-UX-003–004                                     | Manual + automated |
| QUAL-003 | Verify public configuration is readable but immutable and contains no protected secrets.                                               | NFR-SEC-007; NFR-PRV-004–007; NFR-OPS-001–003, NFR-OPS-008 | Other layer        |
| QUAL-004 | Verify local/test/prod configuration resolves to separate projects and never mixes customer data or credentials.                       | NFR-PRV-006; NFR-AVL-004–005; NFR-OPS-006–007              | Other layer        |
| QUAL-005 | Measure initial route payload and interactive readiness against an agreed budget once numeric targets are approved.                    | NFR-PER-002                                                | Planned            |
| VIEWPORT-ADMIN-001 | Keep the core staff navigation visible and free of horizontal overflow at the desktop viewport.                         | NFR-UX-001, NFR-UX-004                                     | Automated          |
| BROWSER-PUB-001 | Keep public account entry and responsive form input usable across Chromium, Firefox, phone WebKit, and tablet WebKit.          | NFR-UX-001, NFR-UX-004                                     | Automated          |
| BROWSER-ADMIN-001 | Keep staff sign-in, navigation, and manual scan entry usable across Chromium, Firefox, phone WebKit, and tablet WebKit.      | NFR-UX-001, NFR-UX-004                                     | Automated          |

## Executable spec map

| Feature                                                       | Playwright location                           |
| ------------------------------------------------------------- | --------------------------------------------- |
| Public entry and operating controls                           | `tests/public/entry-and-controls.spec.ts`     |
| Customer account and session access                           | `tests/public/account-access.spec.ts`         |
| Registration, children, appointment, submission, confirmation | `tests/public/registration-lifecycle.spec.ts` |
| Staff identity, authorization, runtime-gated navigation, and scan-audit rules | `tests/admin/access-and-controls.spec.ts`     |
| Staff lookup by name, email, and confirmation code             | `tests/admin/search-and-lookup.spec.ts`       |
| Staff event-day check-in, scan-risk review, and assisted intake | `tests/admin/checkin-and-registration.spec.ts` |
| Owner-operation authorization, safe completion, previews, and confirmation guard | `tests/admin/owner-operations.spec.ts`        |
| Admin email-template manager entry                            | `tests/admin/email-templates.spec.ts`        |
| Admin staff user management                                  | `tests/admin/users.spec.ts`                 |
| Admin reporting route entry                                  | `tests/admin/reporting-entry.spec.ts`      |
| Schedule and capacity administration                          | `tests/admin/schedule-editor/*.spec.ts`       |
| Automated accessibility checks                               | `tests/{public,admin}/accessibility.spec.ts`  |
| Desktop staff navigation smoke                               | `tests/admin/desktop-smoke.spec.ts`           |
| Cross-browser and device compatibility smoke                 | `tests/{public,admin}/browser-device-smoke.spec.ts` |

## Coverage boundaries

Playwright is the acceptance layer for browser-visible workflows. It does not
replace:

- Firebase rules and Functions integration tests for authorization, ownership,
  validation, audit records, idempotency, and durable side effects;
- performance/load tests for event-day latency and recurring-job deadlines;
- backup/restore drills and export-security verification;
- accessibility tooling plus manual assistive-technology review.

When a planned workflow is implemented, add deterministic emulator seeding or
inspection first, add its Playwright scenario under the feature path above,
change its status to **Automated**, and include its requirement IDs in the test
title or a nearby comment.
