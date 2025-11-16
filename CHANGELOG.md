# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to a versioning scheme of `year.minor.patch`.

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
