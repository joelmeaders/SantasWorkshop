# Changelog - @santashop/functions

## [Unreleased]

### Added

- Add authenticated shopper status reads and admin/owner status and audit callables for the shopper-access UI. Existing Firestore and Storage rules and registration permissions are unchanged.

## [2026.10.29] - 2026-11-16

### Added

- Add gated review case management, incremental overnight matching, reversible registration actions, and optional bilingual notifications.

## [2026.10.28] - 2026-11-16

### Fixed

- Allow eligible shoppers to join the waiting list during maintenance without changing booking, account eligibility, or email rules.

## [2026.10.27] - 2026-11-09

### Fixed

- Await validated public settings before new signup and registration mutations, with a bounded deadline and no stale or build-default admission.
- Preserve completed mutation replay, authenticated signup recovery, and existing no-op paths during settings outages.
- Keep informational settings reads cached and validate campaign-start settings independently of its preview.
