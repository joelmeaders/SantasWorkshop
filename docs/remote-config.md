# Public controls in Remote Config

The client Remote Config template is the only deployed source for public controls.
The `santashop_public_parameters` JSON parameter contains the complete `PublicParameters`
object: registration and staff switches, maintenance and weather flags, messages,
and the bilingual global alert. Keep it unconditional. Do not put it in an
experiment or personalization rule. These controls also gate backend operations.

The customer and admin applications retain `PUBLIC_PARAMETERS_SOURCE` and the
existing `AppStateService` observables. Ordinary records, schedules, email
templates, and runtime environment settings remain in their existing stores.

## Loading and faults

- Each app starts with validated activated settings, or the settings bundled in
  its release. It fetches on startup and registers one real-time listener.
- Published changes are activated immediately. Reconnection, visibility, and
  focus events request a refresh with a 60-second minimum fetch interval.
- Failed or malformed updates retain the last valid object. Retry delays are
  10, 30, 60, and then 300 seconds. Hidden tabs pause application retry timers.
- A failed real-time stream keeps a visible-tab fetch fallback until a real-time
  callback confirms recovery. A successful ordinary fetch alone cannot prove
  that the stream recovered.
- `RemoteConfigPublicParametersSource.status$` reports defaults/remote/local
  source, refresh state, last accepted update time, and the last error.
- Configuration fetches are not included in service-worker data caches.

Backend mutation checks use Admin SDK `getTemplate()` on the **same client
template**. They do not use the separate server-template feature. An instance
returns its cached settings and starts an on-demand background refresh after ten
seconds. Cold instances return release defaults while fetching. Failures retain
the previous object and use the retry backoff above. Reads have a ten-second
logical deadline; late results cannot replace a newer cache value.

The controls are no longer part of a Firestore transaction. Existing operation
predicates and idempotency receipt handling are unchanged. In-flight actions can
finish after a switch changes. Outages can extend stale settings. Background
work also depends on the Functions instance receiving CPU time; ten seconds is
a refresh eligibility interval, not a delivery guarantee.

## Owner editing

Owners open **App settings** from the admin landing page. The screen is available
during maintenance and exposes all fields with an explicit Publish action.
Unsaved edits survive validation, network, and version-conflict errors.

`readPublicParametersSettings` returns `{ settings, etag, version }`.
`publishPublicParametersSettings` accepts `{ settings, expectedEtag }`. Both
callables enforce owner claims before accessing configuration. Publishing
validates the full schema, checks the ETag, preserves unrelated parameters and
groups, and never forces an overwrite. Audit logs record the actor, changed
fields, and published version. If publication has an uncertain result, reload
the current version before retrying.

## Migration and release order

The files under `remote-config/migration/` are prepared candidates, not evidence
of publication. Each has a provenance file with project ID, source update time,
source template version, expected ETag, and candidate hash. The initial test
document lacked `globalAlert`; its candidate represents the old behavior with a
disabled empty alert. The production candidate preserves the existing closed
registration and maintenance state.

1. Re-read each project's current Firestore document and Remote Config template
   before its release. Check that the candidate still matches the intended
   operating settings and has no conditional override. Never replace an already
   migrated Remote Config parameter with legacy Firestore data.
2. Provision the reader and publisher identities described below. Enable the
   Remote Config and Remote Config Realtime APIs. Resolve the quota gate.
3. Validate and publish the reviewed candidate using its source ETag. Stop on an
   ETag conflict and rebuild the candidate from current data. Preserve unrelated
   template content. Do not use a wildcard ETag or force an overwrite.
4. Generate release defaults from the **published** template. The script rejects
   a snapshot for the wrong project and a candidate without a published version.
5. Deploy Functions through the existing GitHub Actions release workflow, then
   deploy both apps. Production remains a separate, explicit release.
6. Test the owner editor and real-time delivery in the deployed test project.
   Record the published version, actual client delivery time, backend behavior,
   retry recovery, and rollback result. A ten-second healthy-client target is
   an acceptance measurement, not a platform SLA.

No code reads `parameters/public` after migration. Its preexisting document is
left untouched. Older app versions still read it and cannot receive new settings.
Require those clients to upgrade. Do not delete the document as part of release.
Rolling back application code requires a separate review of the old client's
settings source; rolling back a Remote Config version alone does not fix that.

Read-only and local preparation commands (Node.js and existing workspace dependencies):

```sh
node scripts/remote-config.cjs fetch --project santas-workshop-test --output test.snapshot.json
node scripts/remote-config.cjs prepare --project santas-workshop-test --document test.firestore.json --snapshot test.snapshot.json --output test.template.json
node scripts/verify-public-parameters.cjs test.template.json
node scripts/remote-config.cjs release-defaults --project santas-workshop-test
pnpm run remote-config:readiness:test
```

Use the explicit production project ID for production artifacts. Authentication
uses Application Default Credentials, `REMOTE_CONFIG_SERVICE_ACCOUNT` in CI, or
an ephemeral `REMOTE_CONFIG_ACCESS_TOKEN`. Never save tokens in artifacts or pass
them as command-line arguments. Release workflows fetch and validate the current
template before compiling matching fallback defaults; they do not publish it.

## Identities and capacity

The six migrated mutation functions and the owner read callable use
`remote-config-reader@PROJECT_ID.iam.gserviceaccount.com`. Grant that account:

- Project `roles/cloudconfig.viewer`, `roles/datastore.user`, and
  `roles/logging.logWriter`.
- Bucket `roles/storage.objectUser` on the project's QR bucket. Cancellation
  replaces existing QR images, so object-creator permission alone is insufficient.
  The readiness gate requires an unconditional binding because it does not
  evaluate IAM conditions. A narrower grant restricted to `registrations/`
  requires separate permission evidence and a reviewed gate update.

The publish callable uses `remote-config-publisher@PROJECT_ID.iam.gserviceaccount.com`.
Grant it project `roles/cloudconfig.admin` and `roles/logging.logWriter`.
The CI deployment principal needs permission to act as these service accounts;
the release principal also needs template-read and readiness-inspection access.
Do not grant the reader a broad Editor role. Existing shared runtime roles are
not changed for unrelated functions.

Optional `SANTASHOP_REMOTE_CONFIG_READER_SERVICE_ACCOUNT` and
`SANTASHOP_REMOTE_CONFIG_PUBLISHER_SERVICE_ACCOUNT` runtime values override these
identities. Configure matching `TEST_`/`PROD_` inputs in the environment generator
and readiness inspection when using alternatives. Emulator exports omit these
identity overrides.

On September 7, 2026, both projects reported **60 template reads/minute** through
`firebaseremoteconfig.googleapis.com/read_requests`. The six consumers permit 50
instances in total: at six refreshes/minute each, their steady ceiling is 300
reads/minute before cold starts or operator traffic. Release readiness requires
at least **600 reads/minute** and load evidence. Request an increase in Google
Cloud Quotas and verify the effective allocation before release. Cold-start
churn can exceed the steady estimate. The browser fetch quota is separate.

The new service accounts were absent at the initial inspection. The readiness
script checks their direct project bindings, QR bucket permission, published
settings, and template-read quota. It reports each missing prerequisite and
blocks a Functions release. This is a deployment check, not a runtime customer
gate. IAM inheritance and load behavior still require release review.

## Emulator tests

Remote Config has no emulator. Local providers call the emulator-only
`testReadPublicParameters` callable. It reads `_testConfig/publicParameters`.
The owner editor reads/publishes the same local fixture with a Firestore update
time used as its conflict token. The backend requires both Functions emulator
mode and `FIRESTORE_EMULATOR_HOST`. Seed helpers merge complete nested defaults.
No client Firestore rule is opened for these fixtures. Local cleanup includes
the fixture collection. Emulator results do not establish deployed real-time
delivery or production IAM correctness.
