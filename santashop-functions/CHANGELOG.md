# Changelog - @santashop/functions

## [Unreleased]

## [2026.10.28] - 2026-11-16

### Fixed

- Let eligible customers join the waiting list during maintenance without changing booking, account eligibility, or email rules. Remove unreleased shopper-access callables and retain warm-request isolation coverage.

## [2026.10.27] - 2026-11-09

### Fixed

- Await validated public settings before new signup and registration mutations, with a bounded deadline and no stale or build-default admission.
- Preserve completed mutation replay, authenticated signup recovery, and existing no-op paths during settings outages.
- Keep informational settings reads cached and validate campaign-start settings independently of its preview.
