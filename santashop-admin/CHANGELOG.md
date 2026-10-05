# Changelog - @santashop/admin

## [Unreleased]

### Changed

- Use compact bordered surfaces across admin screens, with responsive registration forms, report toolbars, settings groups, and template editor columns.
- Collapse schedule generation and per-slot editing until needed, retaining existing save and confirmation behavior.
- Clarify the coupon handoff and next-shopper action, place cancellation after review content, and compact the appointment picker.

## [2026.09.0-beta.9] - 2026-10-02

### Changed

- Advance the admin application to `2026.09.0-beta.9`.

### Added

- Add independent owner controls for waiting-list opt-in and email sending, with preview, confirmation, progress, and resume for manual English/Spanish capacity campaigns.
- Add waiting-list email starters with environment-specific registration and membership links and bilingual FAQ links.

### Fixed

- Wait for preferences dismissal before reopening the popover in the mobile browser test.

## [2026.09.0-beta.8] - 2026-09-20

### Changed

- Advance the admin application to `2026.09.0-beta.8`.
- Restyle the application with responsive neumorphic surfaces, navigation, forms, dialogs, reports, and staff tools.
- Keep main-screen actions aligned with check-in, admin, and owner permissions.

### Fixed

- Remove Ionic form underlines and empty helper strips, including the line above validation messages.
- Restore the check-in staff preview after its role-change test so it does not display owner actions.

## [2026.09.0-beta.6] - Unreleased

### Changed

- Align the admin release version with the workspace's registration fixes. Admin behavior is unchanged.

All notable changes to the admin application will be documented in this file.

## [2026.09.0-beta.3] - Unreleased

### Added

- Owner-only App settings for switches and bilingual messages, with explicit publishing and retained edits on version conflicts.
- Friendly update prompts and reload recovery.

### Changed

- Advance the application to `2026.09.0-beta.3`.
- Read public controls through shared Remote Config with cached continuity and real-time activation.
- Improve service-worker caching and use stable Ionic tab selectors in browser tests.

## [2026.09.0-beta.2] - Unreleased

### Changed

- Advance the application version to `2026.09.0-beta.2`.
- Run the complete Storybook validation with the normal admin application test gate.
- Use Angular signals for component and page UI state.
- Strengthen unit and staff browser coverage, assertions, and test isolation.
- Keep registration codes stable across cancellation and later re-registration.
- Block canceled codes during cancellation and accept the same code after re-registration.

## [2026.09.0-beta.1] - Unreleased

### Changed

- Advance the application version to `2026.09.0-beta.1`.
- Create and edit schedule slots in Denver time, independently of the staff device's time zone.

### Fixed

- Use Denver dates and daylight-saving offsets for appointments, staff activity, and schedule statistics.

## [2026.09.0-alpha.2] - Unreleased

### Added

- Six bilingual 2026 email starters with the original DSCS logo, mission, and enlarged responsive QR tickets.
- JSON/HTML import and export, language selection, cancellation templates, plain-text previews, and seasonal review before publication.
- English/Spanish selection for customer preregistration.

### Changed

- Preserve editor drafts when an import is invalid or cancelled, and require unique keys and SES names for new templates.
- Advance the application version to `2026.09.0-alpha.2`.

## [2026.09.0-alpha.1] - Unreleased

### Added

- Add an initial-bundle guard that excludes Firestore and Firebase Storage from the initial JavaScript graph.
- Add explicit refresh, loading, error, and retry controls for reports, staff, search, and scan-risk data.

### Changed

- Set the application version to `2026.09.0-alpha.1`.
- Load Firestore behind authenticated routes and use deferred Firestore Lite reads for one-shot queries.
- Retain realtime operational flags and appointment controls.
- Use roles and the distinct owner capability for staff authorization.
- Require explicit email-template fields and string ZIP searches.
- Report security audit findings without blocking PR or deployment workflows.
- Upgraded to Angular 22.1 and the Ionic Angular Angular-22 dev build.
- Uses the esbuild application builder and Angular's zoneless runtime.
- Unit tests now run with native Vitest in headless Chromium.

### Fixed

- Recover owner-operation polling without starting another operation.
- Preserve leading-zero ZIP values in registration forms and searches.

### Removed

- Remove unused NgModule files and implicit email token/QR substitutions.

## [2025.0.1] - 2025-11-09

### Fixed

- Test suite compatibility: Updated Auth mock with `authStateReady` method
- Enhanced ActivatedRoute mock with complete snapshot properties
- Improved test helper implementation for better test reliability

## [2025.0.0] - 2025-11-09

### Added

- Comprehensive test helpers and improved test coverage
- Better type safety across admin services and components

### Changed

- **Breaking**: Migrated to ESLint flat config format
- **Breaking**: Updated to Angular 20.3.10 and Ionic 8.7.9
- **App State**: Refactored to use shared app state service from `@santashop/core`
- **Routing**: Updated routing configuration for standalone components
- **Check-in Flow**: Improved check-in confirmation and duplicate detection
- **Search**: Enhanced search functionality with better error handling
- **Stats**: Updated statistics pages with improved data visualization
- **Forms**: Improved form validation and user feedback

### Removed

- Legacy app-state service (moved to `@santashop/core`)
- Deprecated `.eslintrc.json` configuration

### Fixed

- Test suite compatibility with Angular 20
- Type errors in service dependencies
- Import path inconsistencies
- Component initialization in test specs

---

## Previous Versions

### [2.2.0] - Previous Release

- See git history for changes prior to 2025.0.0
