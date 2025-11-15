# Changelog - @santashop/functions

All notable changes to the Firebase Cloud Functions will be documented in this file.

## [2025.0.0] - 2025-11-09

### Added

- **Test Helpers**: New comprehensive test helper utilities
- **Documentation**: Added detailed Functions Shell guide
- **Email Template**: New 2025 registration confirmation email template
- Function-specific README documentation

### Changed

- **Breaking**: Migrated to ESLint flat config format
- **Breaking**: Updated to Node.js 22
- **Dependencies**: Updated Firebase Admin SDK to v13.6.0
- **Dependencies**: Updated Firebase Functions to v6.6.0
- **Dependencies**: Updated AWS SDK to v3.925.0
- **Build**: Enhanced webpack configuration for better bundling
- **Functions**: Updated all function implementations with improved error handling
- **Scheduled Functions**: Improved scheduled tasks for stats and maintenance

### Removed

- Legacy `.eslintrc.js` configuration
- Legacy `.eslintignore` file
- Old `package-lock.json` (functions has its own npm setup)

### Fixed

- Type errors across function implementations
- Import path inconsistencies
- Function deployment configurations

---

## Previous Versions

### [No Previous Version]

- Functions were previously unversioned
- See git history for changes prior to 2025.0.0
