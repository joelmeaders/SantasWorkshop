# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to a versioning scheme of `year.minor.patch`.

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
