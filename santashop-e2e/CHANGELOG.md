# Changelog - @santashop/e2e

All notable changes to the E2E testing suite will be documented in this file.

## [Unreleased]

### Added

- Requirements-traced public registration lifecycle and staff access/control
  scenarios.
- Stable mobile e2e selectors and reusable registration helpers.
- Separate public and admin emulator orchestration from the workspace root.

### Changed

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
