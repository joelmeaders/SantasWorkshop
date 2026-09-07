# Changelog - @santashop/app

All notable changes to the main application will be documented in this file.

## [2026.09.0-beta.3] - Unreleased

### Changed

- Advance the application to `2026.09.0-beta.3`.
- Receive public controls and bilingual notices through real-time Remote Config while retaining valid settings during outages.
- Add friendly update prompts and reload recovery, improve caching and account-form behavior, and expand browser QA coverage.
- Keep Firestore Lite in the startup graph and existing full Firestore features deferred.

## [2026.09.0-beta.2] - Unreleased

### Changed

- Advance the application version to `2026.09.0-beta.2`.
- Run the complete Storybook validation with the normal customer application test gate.
- Use Angular signals for component and page UI state.
- Strengthen unit and public browser coverage, assertions, and test isolation.
- Preserve the same confirmation code and QR artifact across cancellation and later re-registration.
- Block the code during cancellation and restore its use after re-registration.

## [2026.09.0-beta.1] - Unreleased

### Changed

- Advance the application version to `2026.09.0-beta.1`.
- Display and group appointments in Denver time, including daylight-saving changes.

### Fixed

- Preserve calendar birth dates when reopening a saved child in the editor.

## [2026.09.0-alpha.2] - Unreleased

### Added

- Save the selected language during signup and restore the customer preference on login.
- Persist signed-in language changes from both controls, with translated error messages and retry.

### Changed

- Advance the application version to `2026.09.0-alpha.2`.

## [2026.09.0-alpha.1] - Unreleased

### Changed

- Set the application version to `2026.09.0-alpha.1`.
- Use feature-based signup and pre-registration paths.
- Require stored canonical QR paths and string ZIP values.
- Update English and Spanish wording and customer architecture documentation.
- Report security audit findings without blocking PR or deployment workflows.
- Upgraded to Angular 22.1 and the Ionic Angular Angular-22 dev build.
- Uses the esbuild application builder and Angular's zoneless runtime.
- Unit tests now run with native Vitest in headless Chromium.

### Fixed

- Preserve leading zeros when creating accounts and updating profiles.

### Removed

- Remove profile-version providers and the UID-only QR-path fallback.

## [2025.0.1] - 2025-11-09

### Fixed

- Test suite compatibility: Fixed all spec files to use proper mock factories
- Removed debug console.log statements from environment.test.ts
- Updated test helpers with complete Auth mock (including `authStateReady`)
- Fixed Analytics mock to use proper factory pattern
- Enhanced ActivatedRoute mock with all required snapshot properties
- Fixed E2E test to remove unnecessary debug logging
- Improved service spec files with proper dependency mocking
- Fixed guard spec files to use factory-based mocks

## [2025.0.0] - 2025-11-09

### Added

- Comprehensive test helpers for improved testing
- E2E test coverage for critical user flows (account creation, registration)
- Enhanced accessibility features
- Better error handling and user feedback

### Changed

- **Breaking**: Migrated to ESLint flat config format
- **Breaking**: Updated to Angular 20.3.10 and Ionic 8.7.9
- **App State**: Refactored to use shared app state service from `@santashop/core`
- **Application Service**: Major refactoring for better state management
- **Guards**: Updated all route guards for improved reliability
- **Registration Flow**: Enhanced pre-registration and submission processes
- **Authentication**: Improved sign-in, sign-up, and password reset flows
- **Profile Management**: Better profile editing and email change workflows
- **Children Management**: Improved add/edit child functionality
- **Date/Time Selection**: Enhanced date and time slot selection UI
- **Navigation**: Updated menus and navigation components
- **Translations**: Updated internationalization files (en/es)

### Removed

- Legacy app-state service (moved to `@santashop/core`)
- Deprecated routing modules in favor of standalone routes
- Deprecated `.eslintrc.json` configuration

### Fixed

- Test suite compatibility with Angular 20
- Type errors across components and services
- Import path inconsistencies
- Component initialization issues
- Form validation edge cases
- Navigation state management

---

## Previous Versions

### [3.0.0] - Previous Release

- See git history for changes prior to 2025.0.0
