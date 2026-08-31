# Application Test Coverage Audit

This audit covers the customer app, admin app, shared Angular libraries, Firebase
Functions, and the emulator-backed Playwright suites. It reflects the Angular 22,
zoneless, native Vitest migration.

## Coverage baseline and improvements

| Project | Baseline tests | Current tests | Baseline statements | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Customer app | 67 | 84 | 51.18% | 54.30% | 56.96% | 44.16% | 57.41% |
| Admin app | 83 | 104 | 47.44% | 49.69% | 51.37% | 32.58% | 51.17% |
| Core library | 62 | 62 | 54.01% | 54.01% | 54.16% | 39.33% | 50.77% |

The shared Vitest configuration now enforces conservative global floors of 49%
statements, 50% branches, 30% functions, and 50% lines. These values protect the
current minimum across all three projects without disguising the remaining gaps.
They should be ratcheted upward as lower-value wrapper and template code receives
focused coverage.

The Functions suite has 159 tests across 42 files with 67.46% statements, 50.52%
branches, 73.64% functions, and 68.23% lines. Its Vitest configuration enforces
floors of 65% statements, 50% branches, 70% functions, and 65% lines.

The models library is compilation-validated and exercised through its consumers.
It contains shared contracts rather than a standalone runtime test suite, so the
obsolete empty test target remains removed.

## Added unit coverage

Customer coverage now directly exercises:

- completed and incomplete registration route guards, including child routes;
- check-in route blocking and forced sign-out behavior;
- QR-code storage paths and error propagation;
- operational notice language and image selection;
- appointment-slot query mapping and chronological sorting; and
- signup success, duplicate-account recovery, unexpected failures, redirect,
  loader, and subscription cleanup behavior; and
- profile loading across authenticated and signed-out Auth emissions.

Admin coverage now directly exercises:

- scanner permission, camera selection, hardware changes, and scan failures;
- normal, edited, onsite, invalid, and failed check-in submissions;
- staff listing and create, update, and delete callable contracts;
- name, email, QR-index, registration, and check-in lookup behavior; and
- add/edit child modal initialization and dismissal contracts.

## End-to-end journey map

The public suite covers account creation and validation, sign-in failures,
password reset, guards, operational modes, bilingual registration, referral,
child eligibility and editing, appointment selection and changes, submission,
confirmation, cancellation, check-in, profile maintenance, help, and account
security. It now also opens, validates, and dismisses both required legal
documents during signup.

The admin suite covers authentication and role boundaries, check-in operator and
owner permissions, standard and edited check-in, duplicate handling, registration
and preregistration review, templates and resend workflows, reporting, scheduling,
search, and staff management. It now verifies that an owner-reset staff password
works through the Auth emulator with the replacement credential.

The final browser matrices contain 72 public tests across mobile and desktop and
35 admin tests in the representative mobile project.

## Remaining priorities

The most valuable remaining unit-test targets are the customer profile and
appointment-change orchestration, admin reporting and review page branches,
email-template service failure paths, and thin Firebase wrappers in the shared
libraries. Most of their primary success journeys are already protected by
Playwright, so follow-up tests should focus on error handling, empty data, and
authorization edges rather than duplicating the browser scenarios.

For Functions, prioritize the currently uncovered email-template deletion,
reminder-email dispatch, QR generation, and registration-migration modules. The
first three are active operational paths; the migration module should instead be
removed or explicitly isolated if it is no longer part of supported runtime
behavior.

Admin Playwright currently runs its representative mobile project only. Add a
small desktop admin smoke set if desktop becomes an operationally supported staff
workflow; duplicating every admin scenario across viewports is not currently a
high-value tradeoff.
