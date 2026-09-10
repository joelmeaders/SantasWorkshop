# Integrated test suite

## Purpose

This document turns the business, functional, and non-functional requirements
into an emulator-backed integrated test suite. Tests are grouped by user-facing
feature so that a failure points to a business capability rather than an
implementation layer.

The executable baseline lives in `santashop-e2e/tests/`. Scenarios marked
**Automated** must pass in the normal e2e command. Scenarios marked **Not automated**
remain part of the acceptance suite, but are not added as failing or skipped
Playwright tests until the corresponding workflow and deterministic emulator
setup exist.

## Test environment and execution policy

The [E2E guide](e2e.md) owns commands, emulator configuration, fixture setup,
sequential execution, and supported browsers. The [browser QA guide](../browser-flow-testing.md)
owns deployed/manual QA and production-data safety. API seeds may arrange state,
but must not replace the user interaction under test.

## Coverage status

| Status | Meaning |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Automated | Implemented in Playwright and expected to pass |
| Not automated | Required scenario; blocked by missing workflow, stable test seam, or acceptance detail |
| Other layer | Better verified by Functions integration, rules, security, performance, or operational tests |
| Manual + automated | Requires automated checks plus human accessibility or operational review |

## Feature 1: Public entry, language, and operating controls

| Executable specification | Test IDs | Requirement references |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [accessibility.spec.ts](../../santashop-e2e/tests/public/accessibility.spec.ts)<br>[browser-device-smoke.spec.ts](../../santashop-e2e/tests/public/browser-device-smoke.spec.ts)<br>[entry-and-controls.spec.ts](../../santashop-e2e/tests/public/entry-and-controls.spec.ts) | PUB-001 | BR-018; FR-CUS-001; NFR-UX-001 |
| [accessibility.spec.ts](../../santashop-e2e/tests/public/accessibility.spec.ts)<br>[entry-and-controls.spec.ts](../../santashop-e2e/tests/public/entry-and-controls.spec.ts) | PUB-002, PUB-003, PUB-004 | BR-013; FR-CUS-002–003; NFR-UX-002<br>BR-001, BR-012; FR-SH-007; FR-CUS-004<br>BR-001, BR-005, BR-012; FR-SH-006, FR-SH-008; FR-SH-034; NFR-AVL-001–002 |
| [entry-and-controls.spec.ts](../../santashop-e2e/tests/public/entry-and-controls.spec.ts) | PUB-005, PUB-006, PUB-007, PUB-008 | BR-005, BR-012; FR-SH-008; FR-SH-034; NFR-AVL-001–002<br>BR-012–013; FR-SH-010; NFR-UX-004<br>BR-012; FR-SH-010; FR-SH-034 |

## Feature 2: Customer account and session access

| Executable specification | Test IDs | Requirement references |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [account-access.spec.ts](../../santashop-e2e/tests/public/account-access.spec.ts) | AUTH-001, AUTH-002, AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-012 | BR-002, BR-019; FR-SH-001, FR-SH-011–012; FR-CUS-005–006; NFR-PRV-002–003<br>FR-CUS-005; NFR-UX-005<br>BR-053; FR-CUS-007; FR-SH-029, FR-SH-041; NFR-SEC-011; NFR-UX-005<br>BR-019, BR-029; FR-CUS-008; NFR-DAT-001<br>BR-010; FR-SH-004; NFR-SEC-001<br>FR-CUS-009<br>FR-CUS-008; NFR-UX-004–005<br>BR-029; FR-CUS-010 |

| Test ID | Scenario and expected result | Requirements | Status |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| AUTH-007 | Request password recovery; existing, missing, and rate-limited accounts receive the same neutral acknowledgment. | BR-029; FR-CUS-010; NFR-SEC-013; NFR-PRV-010 | Automated across unit, integration, and browser layers |
| AUTH-009 | Customer A attempts to read or mutate customer B data through the service boundary; access is denied. | BR-010; NFR-SEC-003, NFR-SEC-005 | Other layer |
| AUTH-010 | Externally exposed mutation endpoints reject missing anti-abuse proof outside the emulator while remaining testable locally. | BR-053; NFR-SEC-004, NFR-OPS-006 | Other layer |

## Feature 3: Registration overview, referral, and readiness

| Executable specification | Test IDs | Requirement references |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [checkin-and-registration.spec.ts](../../santashop-e2e/tests/admin/checkin-and-registration.spec.ts)<br>[registration-lifecycle.spec.ts](../../santashop-e2e/tests/public/registration-lifecycle.spec.ts) | REG-001 | BR-021, BR-047; FR-CUS-017–020 |
| [registration-lifecycle.spec.ts](../../santashop-e2e/tests/public/registration-lifecycle.spec.ts) | REG-002, REG-003, REG-004, REG-005, REG-006 | FR-CUS-011–012, FR-CUS-017–020; NFR-DAT-001<br>BR-021, BR-047; FR-CUS-019–020<br>BR-024; FR-CUS-015, FR-CUS-033, FR-CUS-053–054; NFR-DAT-007<br>FR-CUS-014; NFR-MNT-004<br>BR-027; FR-CUS-013, FR-CUS-050–051; NFR-MNT-004 |

## Feature 4: Child management and eligibility

| Executable specification | Test IDs | Requirement references |
| ------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [registration-lifecycle.spec.ts](../../santashop-e2e/tests/public/registration-lifecycle.spec.ts) | CHILD-001, CHILD-003, CHILD-004 | BR-022, BR-048; FR-SH-013; FR-CUS-021–022, FR-CUS-025–027<br>BR-022; FR-CUS-024<br>BR-024, BR-048; FR-CUS-026; FR-SH-030; NFR-DAT-005, NFR-DAT-007 |

| Test ID | Scenario and expected result | Requirements | Status |
| --------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------- |
| CHILD-002 | Edit the child; the updated value replaces the prior value and remains associated with the registration. | BR-022; FR-CUS-023, FR-CUS-027 | Automated |
| CHILD-005 | Submit a crafted invalid child payload outside the UI; the authoritative service boundary rejects it. | NFR-SEC-010; NFR-DAT-002, NFR-DAT-005 | Other layer |

## Feature 5: Appointment selection and capacity

| Executable specification | Test IDs | Requirement references |
| ------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| [registration-lifecycle.spec.ts](../../santashop-e2e/tests/public/registration-lifecycle.spec.ts) | APPT-001 | BR-011, BR-023; FR-SH-014, FR-SH-017; FR-CUS-028–029; NFR-DAT-003 |

| Test ID | Scenario and expected result | Requirements | Status |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------- |
| APPT-002 | Select one appointment; the selection persists on the overview and enables final review. | BR-020, BR-023–024; FR-CUS-030–031; NFR-DAT-006 | Automated |
| APPT-003 | Change a draft appointment and confirm the warning; the registration retains the new selection. | FR-SH-018; NFR-REL-003 | Automated |
| APPT-004 | Two customers reserve near capacity; availability remains accurate as practical without requiring a waitlist or hard overbooking stop. | BR-046; FR-SH-027, FR-SH-042; NFR-PER-008 | Not automated |

## Feature 6: Submission, confirmation, and post-submission changes

| Executable specification | Test IDs | Requirement references |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [registration-lifecycle.spec.ts](../../santashop-e2e/tests/public/registration-lifecycle.spec.ts) | SUB-002, SUB-004, SUB-005, SUB-006, SUB-007 | BR-025; FR-SH-019; FR-CUS-037–038; NFR-DAT-001<br>FR-CUS-014; NFR-MNT-004<br>BR-026; FR-CUS-039, FR-CUS-041–042; NFR-REL-003<br>FR-CUS-040; FR-SH-031; NFR-DAT-002<br>BR-043–045; FR-CUS-043, FR-CUS-052; FR-SH-038–039; NFR-DAT-009–010 |

| Test ID | Scenario and expected result | Requirements | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------- |
| SUB-001 | Review a valid child and appointment, submit, and land on confirmation. | BR-002, BR-024; FR-CUS-032–034; NFR-DAT-002, NFR-DAT-006 | Automated |
| SUB-003 | Submission creates the staff search index and queues confirmation communication without blocking the customer workflow. | BR-006, BR-014–016; FR-CUS-035–036; FR-SH-020; NFR-REL-001–002 | Other layer |
| SUB-008 | A transient communication failure records failure/retry state and produces an in-app customer notice without corrupting registration. | BR-050; FR-SH-022, FR-SH-035–037; NFR-REL-010–013 | Not automated |

## Feature 7: Profile and help

| Executable specification | Test IDs | Requirement references |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [registration-lifecycle.spec.ts](../../santashop-e2e/tests/public/registration-lifecycle.spec.ts) | PROFILE-001, PROFILE-002, PROFILE-003, PROFILE-004 | FR-CUS-011, FR-CUS-044, FR-CUS-049<br>BR-028; FR-CUS-045, FR-CUS-048; NFR-DAT-001, NFR-DAT-008<br>FR-CUS-046; NFR-SEC-005<br>FR-CUS-047; NFR-SEC-005 |

## Feature 8: Staff identity, authorization, and navigation

| Executable specification | Test IDs | Requirement references |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [access-and-controls.spec.ts](../../santashop-e2e/tests/admin/access-and-controls.spec.ts) | STAFF-001, STAFF-002, STAFF-003, STAFF-004, STAFF-005, STAFF-006, OWNER-001, RULES-001, RULES-002 | BR-010, BR-030; FR-SH-002–005; FR-OPS-001; NFR-SEC-002<br>FR-OPS-001–003<br>BR-010, BR-030; FR-SH-003, FR-SH-005; NFR-SEC-002–003, NFR-SEC-008<br>FR-OPS-005<br>BR-039; FR-SH-009; FR-OPS-004; NFR-MNT-003, NFR-MNT-006<br>FR-OPS-041; NFR-SEC-012<br>NFR-SEC-012 |
| [checkin-and-registration.spec.ts](../../santashop-e2e/tests/admin/checkin-and-registration.spec.ts) | STAFF-007 | FR-OPS-041; NFR-SEC-012 |

## Feature 9: Schedule and capacity administration

| Executable specification | Test IDs | Requirement references |
| -------------------------------------------------------------------------------------------------------- | --------- | ---------------------- |
| [edit-and-bulk.spec.ts](../../santashop-e2e/tests/admin/schedule-editor/edit-and-bulk.spec.ts) | SCHED-002 | FR-SH-027 |
| [generate-schedules.spec.ts](../../santashop-e2e/tests/admin/schedule-editor/generate-schedules.spec.ts) | SCHED-003 | FR-SH-014, FR-SH-027 |

| Test ID | Scenario and expected result | Requirements | Status |
| --------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------- |
| SCHED-001 | Generate schedule slots for a configured date range. | BR-001, BR-011, BR-040–041; FR-SH-014, FR-SH-027; NFR-SEAS-001–002 | Automated |
| SCHED-004 | Capacity indicators show reserved/max values and disabled slots are visibly unavailable. | FR-SH-027; NFR-UX-004 | Automated |
| SCHED-005 | Enable a disabled slot at runtime. | BR-001, BR-012; FR-SH-006, FR-SH-014 | Automated |
| SCHED-006 | Delete a schedule row after confirmation. | BR-040; FR-SH-014 | Automated |
| SCHED-007 | Re-run recurring slot availability work safely and complete within one minute under peak-size data. | NFR-REL-009; NFR-PER-004, NFR-PER-009 | Other layer |

## Feature 10: Staff lookup and event-day check-in

| Executable specification | Test IDs | Requirement references |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [search-and-lookup.spec.ts](../../santashop-e2e/tests/admin/search-and-lookup.spec.ts) | CHECKIN-001, CHECKIN-003 | BR-007, BR-015, BR-031; FR-OPS-006–007, FR-OPS-010–011<br>FR-OPS-009 |
| [checkin-and-registration.spec.ts](../../santashop-e2e/tests/admin/checkin-and-registration.spec.ts) | CHECKIN-004, CHECKIN-005, CHECKIN-006, CHECKIN-010, CHECKIN-011 | FR-OPS-012–014; FR-SH-033; NFR-REL-004, NFR-AVL-003<br>BR-004, BR-032; FR-OPS-015–020; NFR-DAT-001–002<br>BR-033; FR-OPS-018, FR-OPS-021–022<br>FR-OPS-012–020<br>BR-040; FR-SH-014; FR-OPS-018 |

| Test ID | Scenario and expected result | Requirements | Status |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------- |
| CHECKIN-002 | Find the same registration by email. | FR-OPS-008 | Automated |
| CHECKIN-INCOMPLETE-001 | An incomplete manual-code match cannot continue to check-in and offers alternate lookup recovery. | FR-OPS-012–014; FR-SH-033; NFR-REL-004, NFR-AVL-003 | Automated |
| CHECKIN-007A | A likely accidental duplicate is blocked with current/prior context, no-coupon instruction, and restart. | BR-034; FR-OPS-024–025; FR-SH-032; NFR-REL-005 | Automated |
| CHECKIN-007B | A late duplicate is blocked and appears in scan-risk review with its timeline. | BR-034; FR-OPS-024–025; FR-SH-032; NFR-REL-005 | Automated |
| CHECKIN-007C | A canceled code stays blocked while canceled; the same code checks in once after re-registration, then a later duplicate is blocked. | BR-034; FR-OPS-024–025; FR-SH-032; NFR-REL-005 | Automated |
| CHECKIN-009 | Measure representative lookup/check-in completion time under peak-size seeded data. | FR-OPS-011; NFR-PER-001, NFR-PER-005 | Other layer |

## Feature 11: Staff-assisted intake and communication support

| Executable specification | Test IDs | Requirement references |
| ---------------------------------------------------------------------------------- | --------- | ----------------------------- |
| [email-templates.spec.ts](../../santashop-e2e/tests/admin/email-templates.spec.ts) | EMAIL-001 | FR-SH-022–023; FR-OPS-034–035 |
| [users.spec.ts](../../santashop-e2e/tests/admin/users.spec.ts) | USER-001 | FR-OPS-041; NFR-SEC-012 |

| Test ID | Scenario and expected result | Requirements | Status |
| ------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------- |
| ADMIN-PRE-001 | Staff preregisters a customer with identity, child, referral, and appointment data. | BR-003, BR-035; FR-OPS-026–027 | Automated |
| INTAKE-002 | Staff preregistration detects a duplicate account and offers a safe recovery path. | FR-OPS-028; NFR-SEC-011 | Not automated |
| INTAKE-003 | Completed preregistration creates confirmation and support artifacts. | FR-OPS-029 | Not automated |
| ADMIN-REG-001 | Staff registers and immediately checks in a walk-in without requiring a customer self-service account. | BR-036; FR-OPS-030–033 | Automated |
| COMMS-001 | Staff locates an eligible registration and requeues confirmation communication. | BR-037; FR-SH-023; FR-OPS-034–035 | Automated |

## Feature 12: Reporting, seasonal isolation, and data lifecycle

| Executable specification | Test IDs | Requirement references |
| ------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [reporting-entry.spec.ts](../../santashop-e2e/tests/admin/reporting-entry.spec.ts) | REPORT-001, REPORT-002, REPORT-003, REPORT-004 | BR-008, BR-038; FR-SH-024, FR-SH-027; FR-OPS-036, FR-OPS-039–040<br>FR-SH-026; FR-OPS-037, FR-OPS-039–040<br>BR-021, BR-047; FR-SH-025; FR-OPS-038–040<br>BR-009, BR-011; FR-SH-017; NFR-DAT-003; NFR-SEAS-001, NFR-SEAS-003 |
| [owner-operations.spec.ts](../../santashop-e2e/tests/admin/owner-operations.spec.ts) | OWNER-002, OWNER-003, OWNER-004 | NFR-SEC-012 |

| Test ID | Scenario and expected result | Requirements | Status |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------- |
| REPORT-ENTRY-001 | Authorized staff can open registration, check-in, and user reporting views with safe empty states. | FR-OPS-036–040; NFR-UX-004 | Automated |
| SCAN-RISK-001 | Current-season scan-risk summaries paginate past 20 customers, keep prior-year data out, and show newest-first timelines. | NFR-DAT-003; NFR-SEAS-001, NFR-SEAS-003 | Automated |
| LIFE-001 | End-of-year operation backs up database content and stored files before purging customer, registration, and check-in data while retaining statistics. | BR-049; FR-SH-040; NFR-PRV-008–009; NFR-SEAS-004–005 | Other layer |
| LIFE-002 | Event-period backups run daily, retain 30 days, produce zip archives, and restore successfully using the documented process. | NFR-REL-007, NFR-REL-014–017 | Other layer |
| LIFE-003 | Exports containing personal contact data are audit logged and password protected. | NFR-OPS-010–011 | Other layer |

## Feature 13: Cross-cutting quality

| Test ID | Scenario and expected result | Requirements | Status |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------ |
| QUAL-001 | Run automated accessibility analysis on critical public and staff routes at the mobile viewport with no serious/critical findings. | BR-052; NFR-UX-003 | Automated |
| QUAL-002 | Perform keyboard, screen-reader, zoom/reflow, contrast, error-identification, and focus-order review against WCAG AA. | BR-052; NFR-UX-003–004 | Manual + automated |
| QUAL-003 | Verify public configuration is readable but immutable and contains no protected secrets. | NFR-SEC-007; NFR-PRV-004–007; NFR-OPS-001–003, NFR-OPS-008 | Other layer |
| QUAL-004 | Verify local/test/prod configuration resolves to separate projects and never mixes customer data or credentials. | NFR-PRV-006; NFR-AVL-004–005; NFR-OPS-006–007 | Other layer |
| QUAL-005 | Measure initial route payload and interactive readiness against an agreed budget once numeric targets are approved. | NFR-PER-002 | Not automated |
| VIEWPORT-ADMIN-001 | Keep the core staff navigation visible and free of horizontal overflow at the desktop viewport. | NFR-UX-001, NFR-UX-004 | Automated |
| BROWSER-PUB-001 | Keep public account entry and responsive form input usable across Chromium, Firefox, phone WebKit, and tablet WebKit. | NFR-UX-001, NFR-UX-004 | Automated on mobile Chromium; Firefox and phone/tablet WebKit not automated |
| BROWSER-ADMIN-001 | Keep staff sign-in, navigation, and manual scan entry usable across Chromium, Firefox, phone WebKit, and tablet WebKit. | NFR-UX-001, NFR-UX-004 | Automated on mobile Chromium; Firefox and phone/tablet WebKit not automated |

The [Playwright configuration](../../santashop-e2e/playwright.config.ts) runs these
browser-device scenarios on the `mobile-chrome` project. The separate
`desktop-chrome-smoke` project runs only `desktop-smoke.spec.ts`; it does not
extend these scenarios to other browsers. Firefox and phone/tablet WebKit remain
acceptance obligations under the same IDs. See the [E2E guide](e2e.md#reliable-browser-assertions)
for the configured browser scope.

## Executable spec map

| Feature | Playwright location |
| -------------------------------------------------------------------------------- | --------------------------------------------------- |
| Public entry and operating controls | `tests/public/entry-and-controls.spec.ts` |
| Customer account and session access | `tests/public/account-access.spec.ts` |
| Registration, children, appointment, submission, confirmation | `tests/public/registration-lifecycle.spec.ts` |
| Staff identity, authorization, runtime-gated navigation, and scan-audit rules | `tests/admin/access-and-controls.spec.ts` |
| Staff lookup by name, email, and confirmation code | `tests/admin/search-and-lookup.spec.ts` |
| Staff event-day check-in, scan-risk review, and assisted intake | `tests/admin/checkin-and-registration.spec.ts` |
| Owner-operation authorization, safe completion, previews, and confirmation guard | `tests/admin/owner-operations.spec.ts` |
| Admin email-template manager entry | `tests/admin/email-templates.spec.ts` |
| Admin staff user management | `tests/admin/users.spec.ts` |
| Admin reporting route entry | `tests/admin/reporting-entry.spec.ts` |
| Schedule and capacity administration | `tests/admin/schedule-editor/*.spec.ts` |
| Automated accessibility checks | `tests/{public,admin}/accessibility.spec.ts` |
| Desktop staff navigation smoke | `tests/admin/desktop-smoke.spec.ts` |
| Cross-browser and device compatibility smoke | `tests/{public,admin}/browser-device-smoke.spec.ts` |

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
