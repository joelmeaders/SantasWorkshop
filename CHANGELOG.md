# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to a versioning scheme of `year.minor.patch`.

## [2026.09.0-beta.6] - Unreleased

### Changed

- Direct registration Help to Facebook messaging in English and Spanish. Use Ionic round social buttons with evergreen backgrounds and contrasting Facebook/Instagram logos on all home states.

- Advance the workspace and both applications to `2026.09.0-beta.6`.
- Collect passwords once during signup and password changes. Add translated Show/Hide controls to customer password fields while preserving the deployed signup API contract.

### Fixed

- Keep the last referral choices reachable and use the available help-sheet width.
- Clear email-change reauthentication passwords when the new address is edited and request no autofill.
- Block invalid account submissions and clear password fields after a successful change.
- Preserve open Ionic sheets during visual screenshot capture.

## [2026.09.0-beta.5] - Unreleased

### Added

- Add English and Spanish throughout the admin interface, with separate device preferences and live translation of open dialogs.
- Add System, Light, and Dark admin appearance settings, applied before the first screen appears.
- Add a typed analytics event contract, bounded error categories, active-language context, and registration journey and recovery events.
- Add calculation timestamps, current registration outcomes, retained daily snapshots, and observed profile-creation trends to yearly reports.
- Add accessible report tables and aggregate CSV downloads with spreadsheet-formula escaping.
- Cover older reports, unavailable calculations, analytics failures, and report downloads with regression tests.

### Changed

- Keep the admin quick-action bar visible on scanner, report, and desktop screens; reduce the header to one row and remove duplicate form underlines.
- Hide reservation and staff-account actions when the signed-in role cannot perform them.

- Redesign the admin app for phones with Home, Check-in, and Search navigation, a desktop sidebar, neutral surfaces, and accessible controls.
- Localize displayed report dates, numbers, and status labels while preserving stored data, CSV contracts, and unavailable historical calculations.
- Advance the workspace and both applications to `2026.09.0-beta.5`.
- Keep legacy report totals readable and label missing new calculations and timestamps as unavailable.
- Keep charts above report tables, use Shoppers for customers, and explain table labels in smaller text.
- Isolate analytics initialization and delivery failures from application startup and business operations.

### Fixed

- Use a valid error event name and exclude raw error messages and customer record identifiers from analytics.
- Distinguish attempted, successful, and failed operations, and record email dialog confirmation only when confirmed.
- Count all stored user profiles and group missing ZIP and referral data independently.
- Include remaining ZIP codes in the registration chart's Other slice.
- Remove capacity calculations from past-year reports and reports without appointment-slot records; retained stats remain readable after the annual reset.

## [2026.09.0-beta.4] - Unreleased

### Added

- Add the independent `santashop_email_sending_enabled` Remote Config control for all application email senders, with a three-minute cache and sending blocked when the setting is unavailable.
- Record suppressed queued emails as terminal so re-enabling delivery does not send an accumulated backlog.
- Add an explicit test-only load deployment mode and guarded network retirement instructions.

### Changed

- Resolve selected releases to immutable commits and automatically verify production evidence, removing manual run IDs, repeated commit approval, and test-skip inputs.
- Run each selected PR browser suite once, on separate customer and staff runners, after unit and build checks. Cancel obsolete validation runs including Functions checks.
- Require both isolated browser suites before Functions test deployment and verify each suite's exact-commit evidence during release reuse.
- Keep app-only validation scoped when a change also updates known documentation or the root changelog.
- Advance the workspace and both applications to `2026.09.0-beta.4`.
- Restore SES credentials and ordinary networking for normal test deployments, and restore the seasonal appointment-counter schedule.
- Deploy the isolation probe only in load-test mode and consolidate load procedures and runtime support under `scripts/load`.
- Keep validation credentials separate from deployment credentials; ordinary PR checks do not require running load infrastructure.

## [2026.09.0-beta.3] - Unreleased

### Added

- Owner-only App settings with bilingual notices, validated publishing, version conflicts, and publication audit logs.
- Remote Config migration candidates, release defaults, dedicated runtime identities, and quota/IAM release checks.
- Friendly application update prompts, including a reload-required recovery state.

### Changed

- Advance the workspace and both applications to `2026.09.0-beta.3`.
- Share backend Remote Config refreshes through a private reader to fit the supported quota without reducing customer-function capacity.
- Deploy and verify the private reader before configuring its callers, and include owner settings callables in release inventory checks.
- Add an opt-in manual deployment mode that skips automated tests for test or production while retaining build and environment checks.
- Move customer, staff, and backend public controls from Firestore to one unconditional Remote Config JSON parameter.
- Retain valid cached settings or release defaults through transient configuration failures, with real-time activation and bounded retries.
- Improve service-worker caching, form recovery, and browser QA coverage.
- Keep existing operation rules and the legacy settings document; older clients must upgrade to receive new settings.

### Fixed

- Route owner settings requests to their callable functions and use the initialized Admin SDK instance.
- Recover silently stalled configuration streams with a visible-page fallback fetch.
- Dismiss cleared operational notices in production builds and show cached closure settings at startup.
- Limit staff registration navigation and direct routes to administrators.
- Preserve confirmation codes and QR images when cancelling and registering again.
- Translate ZIP pattern-validation messages in English and Spanish.
- Permit service-worker fetches of authentication scripts and replace workers that retain the old policy.
- Wait for refreshed cancellation state before returning customers to registration.

## [2026.09.0-beta.2] - Unreleased

### Changed

- Advance the workspace and both applications to `2026.09.0-beta.2`.
- Run the complete Storybook validation in the normal customer and admin test gates.
- Keep the dedicated Storybook pull-request workflow focused on visual comparisons.
- Strengthen unit, emulator-integration, and browser test isolation, assertions, seasonal setup, and workflow coverage.
- Use Angular signals for local UI state across the customer and admin applications.
- Keep each registration's confirmation code and QR artifact stable across cancellation and later re-registration.
- Block the stable code while the registration is canceled, then allow it again after re-registration.
- Align cancellation requirements, test scenarios, and hosted-QA notes with the stable QR lifecycle.

## [2026.09.0-beta.1] - Unreleased

### Changed

- Advance the workspace and both applications to `2026.09.0-beta.1`.
- Create, edit, group, and display appointments in `America/Denver`, independently of the browser or server time zone.
- Derive schedule offsets from the named time zone instead of configuring a separate fixed UTC offset.

### Fixed

- Apply daylight-saving offsets to appointment dates and hourly slots.
- Keep a stored January 1 birthday unchanged when a customer reopens the child editor west of UTC.
- Keep staff activity timestamps as dates until display, and group appointment statistics by the Denver day.

## [2026.09.0-alpha.2] - Unreleased

### Added

- Six 2026 confirmation, reminder, and cancellation email starters in English and Spanish, with the original DSCS logo, mission, plain-text alternatives, and responsive QR tickets.
- Admin JSON/HTML template import and export, immutable language/type identities, unique SES names, and revision-level seasonal review checks.
- Saved customer email-language preferences, login restoration, translated save-error retry, and admin preregistration language selection.

### Changed

- Resolve outgoing templates and appointment dates from the current customer language, with English fallback and published-revision mappings.
- Route cancellation emails through the template system while retaining localized plain-text fallback.
- Increase email QR images from 216 to 432 pixels with proportional phone scaling.
- Advance the workspace and both applications to version `2026.09.0-alpha.2`.

### Fixed

- Prevent unpublished mappings from affecting outgoing email and prevent invalid imports from replacing editor drafts.
- Extend unit, emulator, and browser coverage for language persistence, template transfer, and publication checks.

## [2026.09.0-alpha.1] - Unreleased

### Fixed

- Queue each registration email request separately and guard against stale registration state.
- Refresh customer profile authentication state and localize customer dates and status messages.
- Correct admin sign-in feedback, referral saves, birthday edits, preregistration errors, and schedule field updates.
- Render email-template previews under the site security policy and validate supported placeholders.
- Preserve blocked concurrent check-in audit records and report complete check-in dates.
- Record hosted customer/admin QA results and deployment follow-up in `docs/testing/hosted-qa-2026-09-05.md`.

### Added

- Admin bundle-size guard and browser coverage for refresh, concurrency, disconnected reads, and owner-operation recovery.

### Changed

- Set the workspace and both application versions to `2026.09.0-alpha.1`.
- Defer admin Firestore loading until authenticated routes and add explicit server refresh for reports, staff, search, and scan-risk views.
- Require roles and owner authorization, canonical QR paths, string ZIP codes, published email templates, and target-prefixed build inputs.
- Update ESLint to version 10 and refresh architecture, configuration, and testing documentation.
- Restore all six changelogs with historical release entries.
- Make security audits informational in PR and deployment workflows. Keep findings in logs and job summaries without blocking later steps.
- Upgraded the Angular workspace to 22.1, Ionic Angular to the immutable Angular-22 dev build, Node.js to 24.18.0, and TypeScript to 6.0.
- Migrated application builds to Angular's esbuild application builder and removed Zone.js from the frontend runtime.
- Replaced frontend Karma/Jasmine tests with Angular's native Vitest runner in headless Chromium.

### Removed

- Remove the repository Angular developer skill and all reference files.
- Remove unused profile migration fields, the referral-update API, compatibility paths, historical email assets, and unused dependencies.

### Fixed

- Supply explicit local emulator settings to Functions PR and release browser-test steps.
- Resume owner-operation status polling with the same job ID after a read failure.
- Preserve leading zeros in account, registration, profile, and search ZIP codes.
- Correct E2E guidance for signup referral selection, role claims, configuration, ports, and failure traces.

## [2025.2.1] - 2025-11-15

### Added

- **Registration Capacity Insights**: Admin stats dashboard now surfaces "Capacity by Day" cards with donut charts so admins can see used, remaining, and overflow slots at a glance.
- **Test Helper Enhancements**: Added reusable FireRepoLite and PROGRAM_YEAR providers to simplify Angular admin component testing.

### Changed

- **Schedule Charts**: Each schedule bar chart now shows the total number of families for that day directly in the heading for faster scanning.
- **Admin Detection Logic**: Landing page admin toggle now keys off `meaders` email addresses to keep the new stats tooling limited to the intended team.

## [2025.2.0] - 2025-11-15

### Added

- **Admin Check-In DateTime Change**: Admins can now change registration date/time during the check-in review process
    - New "Change Date/Time" button on admin check-in review page
    - Date/Time modal component with accordion-grouped available time slots
    - Real-time availability display showing remaining spots for each time slot
    - Confirmation dialog when changing from existing reservation
    - Automatic email notification sent to registrant with updated date/time
- **Enhanced Firebase Functions**: Updated `changeRegistrationDateTime` function to support admin operations
    - Admins can change date/time for any registration (with proper permission checks)
    - Non-admin users can only change their own registrations
    - Prevents changes after check-in to maintain data integrity
- **Program Year Configuration**: Added `PROGRAM_YEAR` injection token to admin application
    - Centralized program year management (set to 2025)
    - Used by date/time selection to filter available slots
- **Firebase Hosting Rewrites**: Added `changeRegistrationDateTime` function to admin hosting configuration

### Changed

- **Review Page UI**: Updated check-in review page layout
    - Delete button now only shows when registration exists
    - Improved button text from "Cancel Reservation" to "Delete" for clarity
    - Date/time display now includes change button when reservation exists

### Fixed

- Removed duplicate batch.set call in `changeRegistrationDateTime` function

## [2025.1.0] - 2025-11-15

### Added

- **Registration DateTime Change**: Users can now change their registration date/time after initial submission
    - New modal component for selecting alternative date/time slots
    - Prevents changes after check-in to maintain event integrity
    - Sends updated confirmation email automatically
    - Admin control via `allowChangeRegistration` parameter
- **Core Services**: New `changeRegistrationDateTime` callable function for backend processing
- **App State Management**: Added `allowChangeRegistration$` observable to centralize admin controls
- **Translations**: Added new translation keys for date/time change feature (English & Spanish)
    - "CONTINUE", "SUCCESS" in common translations
    - "SELECT_DATETIME" in schedule section
    - Full set of confirmation change messages

### Changed

- **Code Formatting**: Applied Prettier formatting across entire codebase
    - Consistent indentation and spacing in all TypeScript, HTML, and SCSS files
    - Updated ESLint configurations for better formatting rules
- **Models**: Added `allowChangeRegistration` to `PublicParameters` admin interface
- **Functions**: Enhanced email template creation for registration confirmations

### Fixed

- Minor whitespace and formatting inconsistencies throughout the codebase
- Import statement organization and ordering

## [2025.0.1] - 2025-11-09

### Added

- **TimeSlot Pipe**: New custom pipe for formatting appointment time slots (e.g., "10AM - 11AM")
    - Displays start and end times for one-hour time slots
    - Supports timezone parameter for proper time zone handling
    - Includes comprehensive unit tests

### Changed

- **UI Improvements**: Updated time display formatting across registration flow
    - Date/time selection page now uses TimeSlot pipe for consistent formatting
    - Schedule card component uses TimeSlot pipe instead of raw date formatting
    - Submit page displays time slots in user-friendly format
- **Translations**: Updated infant toy messaging to be more inclusive
    - English: Changed from "gender neutral toys" to "toys for children ages 0-2"
    - Spanish: Updated to match new English messaging

### Removed

- Outdated face mask recommendation from event information page

### Fixed

- Test suite compatibility: Updated test mocks and helpers for better reliability
- Removed debug console.log statements from test environment configuration
- Fixed Auth mock to include `authStateReady` method
- Fixed Analytics mock to include proper app structure
- Fixed ActivatedRoute mock to include all required snapshot properties

## [2025.0.0] - 2025-11-09

### Added

- **E2E Testing**: New Playwright-based end-to-end testing framework (`santashop-e2e` package)
- **Workspace Support**: Migrated to pnpm with workspace configuration for better monorepo management
- **Test Helpers**: New shared test helper utilities in `test-helpers/` directory
- E2E test scripts for automated testing workflows
- Concurrent task execution support for parallel builds

### Changed

- **Breaking**: Migrated from npm to pnpm package manager
- **Breaking**: Updated to ESLint flat config format (eslint.config.js)
- **Dependencies**: Updated Angular to v20.3.10
- **Dependencies**: Updated Ionic to v8.7.9
- **Dependencies**: Updated Firebase to v11.10.0
- **Dependencies**: Updated all major dependencies to latest versions
- **Versioning**: Changed version scheme from semantic versioning to `year.minor.patch` format
- Improved build scripts with workspace-aware commands
- Enhanced CI/CD configuration for admin and app builds

### Removed

- Legacy `.eslintrc.json` configuration files
- Legacy `.eslintignore` files
- `package-lock.json` (replaced by `pnpm-lock.yaml`)

### Fixed

- Various TypeScript type errors and linting issues
- Build configuration inconsistencies across packages
- Import path optimizations

---

## Previous Versions

### [4.3.1] - Previous Release

- Last release using semantic versioning and npm
- See git history for details of changes prior to 2025.0.0
