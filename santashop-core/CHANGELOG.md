# Changelog - @santashop/core

All notable changes to the core library will be documented in this file.

## [2026.09.0-beta.3] - Unreleased

### Added

- Shared Remote Config public-settings source with validated defaults, lifecycle recovery, retry backoff, and configuration status.
- Shared application update service and user prompts.

### Changed

- Remove Firestore public-settings sources while preserving the source interface and AppStateService observables.

## [2026.09.0-alpha.1] - Unreleased

### Added

- Add separate shared admin entry points and public-parameter sources for deferred Firebase loading.

### Changed

- Use roles and the distinct owner capability in shared authorization.
- Document supported one-shot and realtime repository contracts.
- Upgraded peer dependencies to Angular 22.1 and migrated unit tests to native Vitest in headless Chromium.

### Removed

- Remove the profile-version token and unused referral-update callable wrapper.

## [2025.0.1] - 2025-11-09

### Fixed

- Test suite compatibility: No changes required for this package

## [2025.0.0] - 2025-11-09

### Added

- **App State Service**: New centralized app state management service
- Enhanced contextual data helpers
- Improved type definitions across services

### Changed

- **Breaking**: Migrated to ESLint flat config format
- **Breaking**: Updated peer dependencies to Angular 20 and Firebase 11
- **Auth Wrapper**: Improved authentication wrapper with better error handling
- **Firestore Wrapper**: Enhanced Firestore wrapper with improved type safety
- **Fire Repo Lite**: Refactored repository service with better performance
- **Auth Service**: Enhanced authentication service with improved state management
- **Error Handler**: Better error logging and reporting

### Removed

- **Breaking**: Removed deprecated `FireRepoBase` service
- Legacy `.eslintrc.json` configuration

### Fixed

- Type errors in service wrappers
- Import path inconsistencies
- Test suite compatibility issues
- Date/time helper edge cases

---

## Previous Versions

### [1.0.0] - Previous Release

- See git history for changes prior to 2025.0.0
