# Changelog - @santashop/functions

## [Unreleased]

### Added

- Add authenticated shopper status reads and admin/owner status and audit callables for the shopper-access UI. Existing Firestore and Storage rules and registration permissions are unchanged.

## [2026.10.28] - 2026-11-15

### Added

- Support optional keyed submission evidence on new, successful shopper registration receipts. It stays off until a key is securely configured.

## [2026.10.27] - 2026-11-09

### Fixed

- Await validated public settings before new signup and registration mutations, with a bounded deadline and no stale or build-default admission.
- Preserve completed mutation replay, authenticated signup recovery, and existing no-op paths during settings outages.
- Keep informational settings reads cached and validate campaign-start settings independently of its preview.
