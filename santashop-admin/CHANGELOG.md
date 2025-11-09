# Changelog - @santashop/admin

All notable changes to the admin application will be documented in this file.

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
