# Changelog - @santashop/app

All notable changes to the main application will be documented in this file.

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
