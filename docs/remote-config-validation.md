# Remote Config migration validation

Validation date: September 7, 2026. Evidence below describes the local migration
checks before test environment setup.

## Local evidence

- Functions: 383 unit tests passed across 61 files. This includes operation
  predicates, idempotency, stale-cache continuity, owner authorization, ETag
  conflicts, schema validation, candidate preparation, and release-readiness checks.
- Focused Angular tests: 16 shared source/SDK tests, 9 customer tests, and 24
  admin tests passed. Five owner-editor Storybook tests also passed.
- Customer emulator browser suite: all 50 tests passed. This covers controls,
  bilingual notices, registration, appointments, and submitted-record lifecycles.
- Owner-editor emulator tests: all three passed, covering publication,
  non-owner route denial, and retention of unsaved edits after a conflict.
- Final combined admin access/settings emulator suite: all 15 tests passed.
  Both changed E2E files passed lint. All five generated configuration files
  were restored byte-for-byte and owned emulator/server processes were stopped.
- App and admin lint completed without errors, with 49 and one existing warning,
  respectively. Functions and changed shared/tooling files passed lint.
- Models, core, Functions webpack, and production-mode app/admin builds passed.
  Admin initial static JavaScript is 1,323,861 bytes against a 1,350,000-byte
  budget. Full Firestore remains deferred to authenticated admin routes.
- Hosting style and cache checks passed. No service-worker configuration changed.

An isolated comparison against HEAD `198c27db19de50ec7b55d243a3fdc3d2a08eb2c5`
measured customer initial static JavaScript at 1,213,906 bytes before and
1,247,620 bytes after: an increase of 33,714 bytes (2.78%). Summed gzip level 9
sizes increased by 9,410 bytes, from 324,413 to 333,823. These are build sizes,
not measured network transfers. Both builds used matching production-mode
configuration. Current bundled settings were local defaults; published default
messages can change release sizes.

Build input graphs confirm Firestore Lite remains in the customer startup
graph, with no full Firestore SDK there. Both baseline and current builds retain
the existing full SDK in deferred pre-registration chunks.

The admin runtime-controls test originally failed because Ionic removes the
tab IDs when applying its disabled state. Captured DOM showed the tabs with
their correct disabled class, and no browser exceptions were captured. The
test now selects those tabs by their destination and keeps its disabled-state
assertions. The final rerun passed.

Emulator providers use explicit local fixtures. These results do not measure
Remote Config delivery from Firebase.

## Remote inspection and release gaps

Separate test and production migration candidates are in
`remote-config/migration/`. Firebase accepted both with `validate_only=true`
(HTTP 200). They have not been published. The legacy Firestore documents,
production settings, and live IAM policies were not changed.

Both projects reported 60 template reads per minute. The planned 50 maximum
consumer instances can request 300 reads per minute at steady load. The release
gate requires at least 600 to reserve capacity for cold starts and operator
traffic. This is a planning threshold, not measured load capacity.

The dedicated reader and publisher accounts were absent at inspection. Resolve
their permissions and quota before releasing Functions. See
[the release procedure](remote-config.md) for identities, order, and defaults.

Deployed-test acceptance remains pending: client delivery without reload and
actual timing, backend propagation, failure recovery, rollback, and measured API
request counts. Complete these after configuration publication and deployment
through the existing release workflow. Production publication is a separate
release step. Older application versions must upgrade to receive new settings.
