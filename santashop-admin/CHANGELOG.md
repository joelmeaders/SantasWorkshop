# Changelog - @santashop/admin

## [Unreleased]

## [2026.11.27] - 2026-11-19

### Changed

- Guide first-time Registration Review staff through finding a case, comparing registrations, and saving the outcome. Clarify what each action changes and when an email is queued.
- Add interactive, email-free child editing, removal, and restoration to the Registration Review Storybook practice case.

## [2026.11.26] - 2026-11-18

### Changed

- Recalibrate startup bundle size limits for Angular's corrected shared-chunk accounting and the measured dependency update growth.
- Read Angular's renamed browser-stats.json output in bundle analysis and the admin CI verification gate.
- Update Angular, Ionic, Firebase, charts, editor libraries, and shared build tooling within their current major versions.

## [2026.11.25] - 2026-11-17

### Changed

- Show the email ban workflow to Registration Reviewers on eligible registrations.
- Rename the bottom Check-in action to Cancel Registration and remove the Shopper Access section from Check-in.

## [2026.11.24] - 2026-11-17

### Changed

- Verify appointment query filters, shared live subscriptions, and listener cleanup on service destruction.

## [2026.11.23] - 2026-11-17

### Changed

- Place registration and child actions with their targets. Keep status and internal notes at case level and use a separate internal reason choice.

## [2026.11.22] - 2026-11-16

### Added

- Add the theme-matched Reports review queue, paginated email and ID search, delegated reviewer access, and action controls.

## [2026.11.21] - 2026-11-16

### Fixed

- Correct self-service cancellation instructions in English and Spanish confirmation and reminder email starters.

## [2026.11.20] - 2026-11-16

### Fixed

- Route staff password-reset requests from Admin Hosting to the existing password-reset function.

## [2026.11.17] - 2026-11-16

### Fixed

- Show shopper access status without the disable or re-enable button on registration review.

## [2026.11.16] - 2026-11-15

### Fixed

- Route hosted shopper access review and update requests to Firebase Functions.

## [2026.11.15] - 2026-11-15

### Added

- Let admins and owners disable or re-enable shopper access from registration review with a required disable reason and an audit record. The controls are not available to check-in-only staff and do not send email or change the registration.

## [2026.11.14] - 2026-11-14

### Changed

- Align the admin app version with the November 14 release.

## [2026.10.29] - 2026-11-11

### Added

- Add bilingual self-service admin password recovery using the existing rate-limited, account-private reset endpoint, available without sign-in or registration access.

## [2026.10.28] - 2026-11-11

### Fixed

- Submit admin sign-in from the password field with Enter using the form submit path.
- Restore HTML editor styling in Ionic slotted layouts, including dark mode.
- Distinguish the current delivery template from older published templates and drafts.
- Remember the chosen scanner camera in this browser across scans and reloads, without overwriting it during automatic camera startup or reset.

### Changed

- Use clearer English and Spanish admin instructions while preserving duplicate-scan warnings and distinguishing queued email from confirmed delivery.

## [2026.10.27] - 2026-11-10

### Changed

- Clarify English and Spanish shopper emails with age-proof examples, birth-certificate copy/photo guidance, alternate-adult requirements, free parking, and RTD trip information.
- Explain email-address sign-in, password privacy, appointment availability preview, and the absence of shopper self-cancellation without changing runtime fields or cancellation semantics.
- Assert registration and RTD links independently in email preview stories and refresh reviewed local and hosted Windows waiting-list preview baselines.

## [2026.10.26] - 2026-10-26

### Fixed

- Refresh reviewed waiting-list email preview baselines for the confirmed 2026 dates, address, and parking directions.
- Use confirmed 2026 shop dates, address, and parking directions in English and Spanish appointment and waiting-list email starters without asserting general shopping hours.
- Preserve runtime registration links and cancellation semantics, require seasonal review for dated waiting-list starters, and add starter-content regression tests.

### Changed

- Release the confirmed 2026 event details: 1812 35th Street, Denver, CO 80216, parking off Brighton Blvd., and December 11, 12, 14, and 15.
- Advance the affected packages to stable version `2026.10.26`.

## [2026.09.0-beta.12] - 2026-10-23

### Fixed

- Recover a failed email by queue ID without requiring an active registration search index or email address. Keep explicit uncertain-delivery acknowledgement and confirm the recovered queue ID (#211).

- Retain the same on-site registration request after an uncertain result and prevent concurrent submissions (#206).

## [2026.09.0-beta.11] - 2026-10-12

### Changed

- Advance the admin application to `2026.09.0-beta.11`.
- Use compact bordered surfaces across admin screens, with responsive registration forms, report toolbars, settings groups, and template editor columns.
- Blend field backgrounds into their section and remove outer settings containers.
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
