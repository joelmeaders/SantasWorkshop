# Changelog - @santashop/models

All notable changes to the shared models library will be documented in this file.

## [2026.09.0-alpha.1] - Unreleased

### Changed

- Require string ZIP values in account creation and profile update requests.
- Name demographic date/time statistics by purpose and retain their schema separately from appointment reservation counters.

### Removed

- Remove unused profile-version and migration fields, the referral-update request, and the unused second email queue identifier.

## [2025.0.0] - 2025-11-09

### Changed

- **Breaking**: Migrated to ESLint flat config format
- Updated peer dependencies to match workspace versions
- Improved build configuration

### Removed

- Legacy `.eslintrc.json` configuration

### Fixed

- Type definitions and exports
- Build output consistency

---

## Previous Versions

### [1.0.0] - Previous Release

- See git history for changes prior to 2025.0.0
