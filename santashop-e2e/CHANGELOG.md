# Changelog - @santashop/e2e

All notable changes to the E2E testing suite will be documented in this file.

## [2026.10.26] - 2026-10-26

### Changed

- Release the confirmed 2026 event details: 1812 35th Street, Denver, CO 80216, parking off Brighton Blvd., and December 11, 12, 14, and 15.
- Advance the affected packages to stable version `2026.10.26`.

## [2026.09.0-beta.12] - 2026-10-23

### Fixed

- Verify a lost email-change response and real token invalidation restore a usable editor from profile and registration review, then finish with the original request and account (#227).
- Resume interrupted signup from a saved non-secret intent, preserve one identity and owned QR object, and recover setup through normal customer sign-in (#207).

- Assert the owner statistics preview rejection after October 15 instead of expecting a preview outside the permitted season.

## [2026.09.0-beta.3] - Unreleased

### Added

- Owner settings publication, access-denial, and conflict tests against explicit emulator fixtures.
- Browser coverage for account recovery and application update behavior.

### Fixed

- Select disabled Ionic navigation tabs by destination after hydration removes their IDs.

## [2026.09.0-beta.2] - Unreleased

### Added

- Add shared season setup for deterministic registration windows.
- Expand public and admin browser assertions for access controls, check-in, registration, reporting, scheduling, email templates, and refresh behavior.

### Changed

- Improve test isolation, fixture reuse, failure artifacts, and workflow path coverage.

## [2026.09.0-alpha.2] - Unreleased

### Added

- Browser coverage for signup language, fresh-session restoration, and persisted language changes.
- Spanish template import, save/reload, JSON/HTML export, and invalid-import preservation coverage.

## [2026.09.0-alpha.1] - Unreleased

### Added

- Add browser cases for data refresh, offline recovery, concurrent operations, lost responses, appointment changes, and owner-status recovery.
- Add leading-zero ZIP signup and staff-search regression coverage.
- Requirements-traced public registration lifecycle and staff access/control
  scenarios.
- Stable mobile e2e selectors and reusable registration helpers.
- Separate public and admin emulator orchestration from the workspace root.

### Changed

- Use supported role/owner claims and string ZIP fixtures.
- Retain failure traces with retries disabled.
- Update test guidance to use signup referral selection, existing helpers, and matching E2E configuration and ports.
- Organized specs by public/admin feature.
- Reduced Playwright execution to one Pixel 5 mobile Chromium project and one
  worker.

## [2025.0.0] - 2025-11-09

### Added

- **Initial Release**: New Playwright-based end-to-end testing framework
- Test fixtures for Firebase emulator setup
- Account creation and auto-login test suite
- Example test suite for reference
- Comprehensive test reporting
- UI mode for interactive test development
- Debug mode for troubleshooting tests
- Codegen support for test generation

### Configuration

- Playwright configured with Chromium, Firefox, and WebKit browsers
- Test environment configured for local development
- Emulator integration for isolated testing
- Screenshot and video capture on failure
- Parallel test execution support

---

## Previous Versions

This is the initial release of the E2E testing package.
