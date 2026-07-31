## Summary

This analysis was reconciled after the owner-operations implementation. The
former Pub/Sub maintenance handlers, bootstrap-password flow, persistent export
tokens, and Auth-only purge have been removed. Their replacements are
authenticated, App-Check-protected owner callables backed by a serialized Cloud
Tasks worker.

The remaining improvement opportunities are primarily **least-privilege service
accounts, scheduled-job scalability, stronger server-side validation, and
consistency across Auth/Firestore/Storage/SES side effects**.

I reviewed guidance from:

- Firebase Cloud Functions overview, management, config/env, tips, retries, callable functions, Firestore triggers, scheduled functions, locations, quotas, TypeScript, networking, task queues, and App Check.
- Google Cloud Run / Cloud Run functions guidance for concurrency, max/min instances, startup/cold starts, temporary files, service identity, and scaling behavior.

## Current functions inventory

`src/index.ts` exports **37 deployable functions**:

| Category | Count | Functions |
|---|---:|---|
| Production callable functions | 25 | `changeAccountInformation`, `updateReferredBy`, `completeRegistration`, `newAccount`, `undoRegistration`, `changeRegistrationDateTime`, `updateEmailAddress`, `checkIn`, `checkInWithEdit`, `onSiteRegistration`, `callableAdminPreRegister`, `callableResendRegistrationEmail`, `callableListEmailTemplates`, `callableGetEmailTemplate`, `callableGetEmailTemplateRevision`, `callableSaveEmailTemplateRevision`, `callablePublishEmailTemplate`, `callableSendTestEmailTemplate`, `callableCreateStaffUser`, `callableUpdateStaffUser`, `callableDeleteStaffUser`, `callablePreviewOwnerOperation`, `callableStartOwnerOperation`, `callableGetOwnerOperation`, `callableGetOwnerExportUrl` |
| Private task function | 1 | `ownerOperationWorker` |
| Firestore trigger | 1 | `sendNewRegistrationEmails` |
| Scheduled functions | 5 | `scheduledFirestoreBackup`, `scheduledDateTimeSlotCounters`, `scheduledRegistrationStats`, `scheduledUserStats`, `scheduledCheckInStats` |
| Emulator-only helper callables | 5 | `testSeedScenario`, `testSeedPublicParameters`, `testClearAllData`, `testSeedAdminUser`, `testSeedDateTimeSlots` |

There is also **1 unexported/dormant handler** in `src/fn/`:

- `scheduledReindexRegistrations`

## What is already strong

- **Firebase v2 migration is complete.** I found no `firebase-functions/v1` or `functions.config()` usage in `santashop-functions/src/**`.
- **App Check is enforced for production callables** via `ENFORCE_APP_CHECK = process.env.FUNCTIONS_EMULATOR !== 'true'`.
- **AWS secrets are bound only to AWS-email functions** in `index.ts`.
- **Dynamic imports in `index.ts` reduce cold-start blast radius** by deferring handler-specific dependencies until invocation.
- **Server-side capability checks enforce `owner > admin > checkin`**, with
  owner-only checks on high-impact operations.
- **Email sending has an outbox-like queue document model** with retry-safe delivery claims, provider acceptance markers, and registration repair.
- **Tests exist and are modernized** with Vitest plus emulator-backed integration tests.
- **Generated `.env.*` files appear ignored**, and `git ls-files` only showed `.env.example` as tracked.

## Highest-impact recommendations

| Priority | Improvement | Impact |
|---|---|---|
| High | Add explicit `serviceAccount` and selected shared runtime options | Improves security, cost control, and deploy reproducibility |
| High | Move remaining scheduled batch jobs from full-collection reads to paginated/streamed flows | Prevents timeouts, memory growth, and high Firestore read costs as data grows |
| High | Enforce authoritative server-side reads/transactions for registration and slot-capacity flows | Prevents client-tampering and overbooking |
| Medium | Convert env configuration to Firebase parameterized config / `defineSecret` | Better deploy-time validation, safer secret access, fewer discovery-time surprises |
| Medium | Stop using `--fix` in predeploy lint | Avoids deploy-time mutation of source files |

## Cross-cutting findings

### 1. Use dedicated least-privilege service accounts

All functions appear to run under the default 2nd-gen compute service account. Several functions have very different privilege profiles:

- Account creation/deletion: `newAccount`, `callableAdminPreRegister`, staff functions, owner yearly reset
- Email sending/publishing: `sendNewRegistrationEmails`, template callables
- Stats/export jobs: scheduled functions and `ownerOperationWorker`
- Emulator helpers: should not need production identity at all

Firebase/Cloud Run guidance recommends overriding default broad service accounts with custom service accounts scoped to exact resources.

**Impact:** Major security reduction. A bug or compromised function gets fewer permissions.

**Recommendation:**

- Create service accounts such as:
  - `functions-email-sender`
  - `functions-registration-writer`
  - `functions-stats-writer`
  - `functions-staff-admin`
  - `functions-backup-runner`
- Set `serviceAccount` per function or group.
- Especially isolate `ownerOperationWorker`, which performs backups, Auth
  administration, Firestore purges, Storage deletion, and signed export URLs.

### 2. Consider `setGlobalOptions` for other shared defaults

Many function options are repeated or omitted. Firebase v2 allows global defaults, and while region is now explicit, other shared defaults remain worth evaluating.

**Impact:**

- Fewer copy/paste misses.
- Easier to enforce region, service account, max instances, CPU, memory, timeout, labels.

**Recommendation:**

Use `setGlobalOptions` for common defaults, then override per heavy function.

Likely defaults to evaluate:

- `cpu: 'gcf_gen1'` for low-traffic low-memory functions if cost matters
- conservative `maxInstances`
- `concurrency` tuned by function type
- labels for cost ownership

### 3. Revisit v2 CPU/concurrency/cost settings

Cloud Functions v2 defaults to Cloud Run behavior. Firebase docs note that low-memory functions can get a full CPU by default, which may increase per-ms cost compared to 1st gen behavior. Callable functions also default to concurrency up to 80 when eligible.

**Impact:**

- Cost may be higher than expected for low-traffic 128/256MiB functions.
- Mutable global state or non-thread-safe code can behave poorly under concurrency.
- Too-low `maxInstances` can reject/queue requests; too-high can overwhelm Firestore/SES/Auth.

**Recommendation:**

- For low-traffic simple callables, consider `cpu: 'gcf_gen1'` if concurrency is not needed.
- For admin/batch functions with mutable state or external rate limits, set `concurrency: 1`.
- For public callables like `newAccount`, tune `maxInstances` and rate protections.
- Load test before raising concurrency.

### 4. Move env configuration toward Firebase params/secrets

`runtime-config.ts` eagerly loads `.env` files and calls `requireEnv()` at module load.

Firebase recommends **parameterized configuration** for most settings and `defineSecret()` / `defineJsonSecret()` for secrets. It also warns that values read in global scope can affect deploy-time discovery if unavailable.

**Impact:**

- Current code intentionally fails fast when env is missing, which is good locally, but deploy discovery can fail before Firebase has a chance to prompt/validate params.
- Secrets read from `process.env` are less strongly modeled than Firebase `defineSecret`.
- Type and range validation is manual.

**Recommendation:**

- Replace schedule strings, numeric settings, timezone, program year, and bucket names with `defineString`, `defineInt`, `defineList`, etc.
- Replace AWS secrets with `defineSecret('AWS_ACCESS_KEY_ID')` and `defineSecret('AWS_SECRET_ACCESS_KEY')`.
- Build SES credentials inside lazy factory methods, not module-level objects.
- Keep `.env` only as local/project parameter source, not as custom loader dependency.

## Function-by-function report

### `changeAccountInformation`

**Current behavior:** Authenticated user updates display name plus `users`, `registrationsearchindex`, and `registrations`.

**Findings:**

- Good: requires `request.auth.uid`.
- Input validation is minimal: only checks first/last/zip presence.
- Auth update happens before Firestore batch; if Firestore fails, Auth display name remains changed while documents are stale.
- Uses client-provided fields directly.

**Improvements:**

- Validate lengths/characters for names and ZIP.
- Normalize ZIP consistently.
- Consider a reconciliation/compensation strategy if Firestore write fails after Auth update.

**Impact:** Better data quality and fewer inconsistent Auth/Firestore records.

### `updateReferredBy`

**Current behavior:** Authenticated user updates `users/{uid}.referredBy`.

**Findings:**

- Good: requires `request.auth.uid`.
- Minimal validation: any non-empty value accepted.
- Uses `update`, so missing user doc throws internal.

**Improvements:**

- Validate against allowed referrer values if the UI has a fixed set.
- Use `set(..., { merge: true })` if missing docs should self-heal.
- Return `not-found` when the user document is missing.

**Impact:** Cleaner analytics and better client error behavior.

### `completeRegistration`

**Current behavior:** Validates a client-supplied `Registration`, checks owner, sets submitted flags, creates/updates email queue doc, and writes search index.

**Findings:**

- Good: owner check and registration completeness guard.
- High risk: it trusts the registration payload from the client instead of reading authoritative server state.
- No transaction checks slot capacity/enabled state.
- `registrationSubmittedOn` check uses client payload, not server doc state.
- Email queue document uses same doc ID, which limits duplicate `onCreate` triggers, but registration completion itself is not transactionally guarded.

**Improvements:**

- Read `registrations/{uid}` inside a Firestore transaction.
- Verify selected slot exists, is enabled, and has capacity.
- Increment/reserve slot count transactionally or move slot reservation into a dedicated function.
- Build search index and email queue from server-side registration data.

**Impact:** Prevents overbooking, tampered registration submissions, and race-condition inconsistencies.

### `newAccount`

**Current behavior:** Public callable creates Firebase Auth user, Firestore user/registration docs, QR code in Storage, then returns UID.

**Findings:**

- Good: rollback attempts delete Auth and Firestore records if setup fails.
- Public unauthenticated account creation relies on deployed App Check for abuse protection.
- Input validation is weak; missing `emailAddress` can throw before a clean `HttpsError`.
- QR code generation and Firestore writes are separate side effects.
- QR code uses `generateId(8)` based on `Math.random`.

**Improvements:**

- Add strict request schema validation before any side effect.
- Add rate limiting / abuse controls around public account creation.
- Consider Firebase Auth’s normal client-side account creation flow plus a server-side post-create/profile function, if compatible with the app.
- Use `crypto.randomInt` / `crypto.randomUUID`-based generation.
- Check QR code uniqueness if the code is used as an identifier.

**Impact:** Reduces account-spam risk, avoids partial setup edge cases, and improves security of generated identifiers.

### `undoRegistration`

**Current behavior:** Admin can undo specified user; regular user can undo self. Deletes search index, moves `dateTimeSlot` to `previousDateTimeSlot`, clears submitted timestamp and counts.

**Findings:**

- Good: prevents regular users from targeting another UID.
- Does not appear to check business settings like cancellation allowed/closed.
- Does not clear email queue docs or pending reminder/confirmation state.
- No transaction for read-modify-write.
- Could leave an email already queued/sending for a registration that has been undone.

**Improvements:**

- Use a transaction for registration mutation.
- Enforce backend business rules, not only UI flags.
- Clear or mark related `tmp_registrationemails/{uid}` queue docs as canceled.
- Consider slot count update/reservation release in the same workflow.

**Impact:** Prevents stale emails and keeps cancellation behavior authoritative.

### `changeRegistrationDateTime`

**Current behavior:** User/admin changes date/time slot and enqueues a new confirmation email.

**Findings:**

- Good: checks admin before allowing `registrationUid`.
- Good: blocks changes after check-in and before completion.
- High risk: trusts `newDateTimeSlot` from client and does not verify the slot document exists, belongs to current program year, is enabled, or has capacity.
- No transaction around slot capacity or registration mutation.

**Improvements:**

- Read `dateTimeSlots/{id}` server-side.
- Transactionally release old slot and reserve new slot.
- Reject disabled/full/out-of-year slots.
- Build email date text from server-fetched slot.

**Impact:** Prevents overbooking and invalid slot assignment.

### `updateEmailAddress`

**Current behavior:** Updates Auth email and user/index/registration email fields.

**Findings:**

- Good: requires authenticated UID.
- No explicit email validation before `toLowerCase()`.
- Auth update happens before Firestore batch; Firestore failure leaves Auth changed but documents stale.
- Admin SDK bypasses client “recent login” requirements; that may be intentional but is more privileged than client-side email updates.
- No verification email flow shown.

**Improvements:**

- Validate email format.
- Consider requiring a verified flow or client reauthentication before calling.
- Add compensation/retry/reconciliation for Auth/Firestore mismatch.
- Return `already-exists` for Auth email conflicts.

**Impact:** Improves account integrity and supportability.

### `checkIn`

**Current behavior:** Admin-capable callable transactionally creates a
`checkins/{uid}` record and sets the source registration's `hasCheckedIn` flag.

**Findings:**

- Good: admin check.
- Good: `create()` makes duplicate check-ins fail.
- Good: check-in creation and source registration status now commit atomically.
- Risk: stats are computed from client-supplied registration fields, not authoritative Firestore registration.

**Improvements:**

- Load registration by UID from Firestore before writing check-in.
- Keep client edits separate from authoritative persisted state.

**Impact:** Authoritative source reads would prevent tampered check-in stats;
the registration-state lag has already been removed by the atomic write.

### `checkInWithEdit`

**Current behavior:** Admin-capable caller transactionally creates the edited
registration snapshot and check-in, then marks the source registration checked
in.

**Findings:**

- Good: admin-only and duplicate protection via `create`.
- Good: edited snapshot, check-in, and source registration status are atomic.
- Risk: trusts edited registration payload.
- Confirms the source registration exists, but does not use it to validate the
  edited payload.

**Improvements:**

- Validate edited data with a schema.
- Consider preserving original-vs-edited diff for auditability.

**Impact:** Better data trust and audit history.

### `onSiteRegistration`

**Current behavior:** Admin creates onsite registration and check-in.

**Findings:**

- Good: admin-only.
- Potential inconsistency: check-in doc ID is generated `id`, but `checkin.customerId` is set to `record.uid`, while registration’s `uid` is overwritten to `id`.
- Uses client-supplied registration data.
- The historical repair job no longer drives this lifecycle, so `customerId`
  semantics should be documented for reporting and exports rather than for
  eventual check-in propagation.

**Improvements:**

- Set `checkin.customerId` consistently to generated onsite registration ID or explicitly to `'onsite'`, depending on downstream expectation.
- Validate onsite registration schema server-side.
- Consider audit fields: `createdByUid`, `createdByEmail`.

**Impact:** Prevents downstream stats/exports confusion.

### `callableAdminPreRegister`

**Current behavior:** Admin creates Auth user, Firestore user/registration/search index, QR code, and email queue.

**Findings:**

- Good: admin-only.
- Good: rollback attempts if later steps fail.
- Uses generated password from `generateId(12)` using `Math.random`.
- No slot capacity transaction.
- Side effects span Auth, Firestore, Storage, and email queue.

**Improvements:**

- Use cryptographic random generation for generated passwords/codes.
- Prefer password reset/invite link instead of creating a live unknown password.
- Validate and reserve slot capacity transactionally.
- Add audit metadata.

**Impact:** Better account security and reduced overbooking.

### `callableResendRegistrationEmail`

**Current behavior:** Owner/admin queues a registration confirmation resend.

**Findings:**

- Good: owner/admin guard.
- Good: checks registration completeness and QR readiness.
- Good: transaction writes queue and registration marker.
- `maxInstances: 2`, `memory: 128MiB` are explicitly set.

**Improvements:**

- Add rate limiting/cooldown to avoid repeated resends.
- Consider admin audit logging.
- Rename `reminderEmail*` fields if reused for confirmation resend; current naming can be semantically confusing.

**Impact:** Prevents email abuse and support confusion.

### `callableListEmailTemplates`

**Current behavior:** Admin lists template summaries.

**Findings:**

- Good: admin-only.
- Full collection read; likely fine unless template count grows.

**Improvements:**

- Add pagination if template history grows.

**Impact:** Low; mainly future-proofing.

### `callableGetEmailTemplate`

**Current behavior:** Admin gets summary, revisions, and current HTML.

**Findings:**

- Good: admin-only.

**Improvements:**

- Consider limiting revision count or lazy-loading revision HTML.

**Impact:** Better client UX and scalability.

### `callableGetEmailTemplateRevision`

**Current behavior:** Admin gets one revision and HTML.

**Findings:**

- Good: admin-only and clear not-found errors.

**Improvements:**

- Add audit logging for template revision reads if templates are sensitive.

**Impact:** Better diagnostics.

### `callableSaveEmailTemplateRevision`

**Current behavior:** Admin saves HTML to Storage and writes template/revision metadata in Firestore transaction.

**Findings:**

- Good: deletes Storage object if Firestore transaction fails.
- Good: validates mappings before saving.
- Writes Storage before Firestore transaction; if process crashes after Storage write but before transaction, orphaned HTML can remain.

**Improvements:**

- Add a scheduled cleanup for orphaned `emailTemplates/.../revisions/*.html`.
- Add content size limits for HTML.

**Impact:** Better client feedback and less Storage clutter.

### `callablePublishEmailTemplate`

**Current behavior:** Admin upserts SES template, then updates Firestore template/revision published metadata.

**Findings:**

- Good: SES client is cached.
- Good: uses bound AWS secrets in `index.ts`.
- External SES side effect cannot be transactionally tied to Firestore metadata.
- If SES update succeeds and Firestore update fails, system is out of sync.
- Credentials are captured in a module-level object from `process.env`.

**Improvements:**

- Build credentials lazily inside `getSesClient`.
- Record a publish operation document with `pending/succeeded/failed`.
- Add reconciliation: compare SES template state to Firestore published revision.

**Impact:** Prevents silent template metadata drift.

### `callableSendTestEmailTemplate`

**Current behavior:** Admin renders and sends direct test email through SES.

**Findings:**

- Good: validates recipient, subject, HTML, and detected fields.
- Good: does not persist test email.
- Same module-level credentials pattern.
- Validation helpers can throw plain errors.
- No rate limiting.

**Improvements:**

- Build SES credentials lazily.
- Add per-admin cooldown or audit log.
- Convert helper validation errors to `HttpsError`.

**Impact:** Better operational safety and client UX.

### `callableCreateStaffUser`

**Current behavior:** An admin creates a check-in staff account; only an owner can create another administrator. The callable creates the Auth user, sets claims, and writes the staff document.

**Findings:**

- Good: validates email, display name, password, roles.
- Good: forces `admin` to also include `checkin`.
- Good: enforces the `owner > admin > checkin` hierarchy server-side.
- If setting claims or writing Firestore fails, deletes Auth user.
- Staff password is passed through callable request.

**Improvements:**

- Prefer invite/password reset link instead of admin-provided password.
- Audit actor UID/email.
- Use a reconciliation job to detect Auth staff users missing staff docs or vice versa.
- Consider custom claims update before/after Firestore consistency guarantees.

**Impact:** Better staff account security and recoverability.

### `callableUpdateStaffUser`

**Current behavior:** An admin updates ordinary check-in staff. Only an owner can alter an administrator, and owner accounts are managed outside the app.

**Findings:**

- Good: ordinary administrators cannot alter administrator or owner accounts.
- Good: owner claims cannot be granted or revoked through this callable.
- Good: validates display name/password/roles.
- Auth and Firestore updates are sequential; partial failure can leave mismatches.
- Allows password change through callable.

**Improvements:**

- Prefer Firebase password reset flow.
- Store audit metadata: `updatedByUid`, `updatedByEmail`.
- Add reconciliation for claims vs staff doc.
- If Firestore write fails after Auth update, retry or mark a repair task.

**Impact:** Reduces support issues from inconsistent staff state.

### `callableDeleteStaffUser`

**Current behavior:** An admin deletes ordinary check-in staff; only an owner can delete an administrator.

**Findings:**

- Good: blocks self-deletion and refuses to delete owner accounts.
- Good: owner transfer and revocation remain exclusive to the local privileged script.
- Auth deletion happens before Firestore deletion; Firestore failure leaves stale staff doc.

**Improvements:**

- Disable Auth user first, delete staff doc, then delete Auth user; or write a tombstone.
- Add audit metadata before deletion.
- Add reconciliation for staff docs without Auth users.

**Impact:** Safer account lifecycle.

### `sendNewRegistrationEmails`

**Current behavior:** Firestore `onDocumentCreated` for `tmp_registrationemails/{docId}`, with AWS secrets, `retry: true`, `maxInstances: 1`, delegates to `sendNewRegistrationEmails2`.

**What is now strong:**

- Retry-safe event claims prevent the same Firestore event from re-sending a queued email.
- SES acceptance is recorded before final `sent` bookkeeping so retries can repair Firestore state without sending a duplicate email.
- Ambiguous same-event retries are flagged for review instead of blindly reissuing the external side effect.
- Queue and registration repair logic still heals partial Firestore persistence failures after a successful delivery.

**Remaining considerations:**

- Consider Cloud Tasks for email delivery with explicit retry config and rate limits.
- Add alerting on `failed`, `accepted`, or long-lived review-required queue documents.
- Add event-age cutoffs or dead-letter handling if operational volumes grow.

### `scheduledFirestoreBackup`

**Current behavior:** Starts Firestore export to configured bucket.

**Findings:**

- Good: dedicated scheduled backup exists.
- No `timeZone` option on this schedule, unlike other scheduled functions.
- Uses `GCP_PROJECT` / `GCLOUD_PROJECT`, fallback empty string.
- Logs export operation name but does not monitor completion.
- Requires broad Firestore export/storage permissions under default service account.

**Improvements:**

- Add `timeZone: SHOP_TIME_ZONE` if the schedule is intended local time.
- Validate non-empty project ID.
- Use a dedicated backup service account.
- Record backup operation metadata in Firestore and alert on failure/staleness.
- Periodically test restore, not just export.

**Impact:** Makes backups auditable and trustworthy.

### `scheduledDateTimeSlotCounters`

**Current behavior:** Loads date/time slots, counts matching completed registrations per slot, updates slot reserved count/enabled and schedule stats.

**Findings:**

- Uses Firestore `offset()`, which is costly as data grows.
- Performs one aggregate count query per slot sequentially.
- Updates each slot individually.
- Logs `slot.slotsReserved` instead of `registrationCount`, which may be misleading.

**Improvements:**

- Replace `offset()` pagination with cursor pagination.
- Use `BulkWriter` or batched writes.
- Consider computing counts from registration changes transactionally instead of scheduled reconciliation.
- Query slots by `programYear` and stable ordering.

**Impact:** Lower Firestore read cost and more reliable schedule capacity.

### `scheduledRegistrationStats`

**Current behavior:** Full reads completed registrations for `PROGRAM_YEAR`, computes date/time and ZIP stats.

**Findings:**

- Full collection query can grow expensive.
- In-memory aggregation is fine for small seasonal data but may timeout at scale.
- Invalid ZIP values can become `NaN` stats entries.
- Does not mark registrations as included; likely intentionally generates snapshot stats.

**Improvements:**

- Add ZIP validation/normalization.
- Page or stream query results.
- Consider incremental stats maintained on registration completion/change.
- Emit metrics: registration count, duration, skipped missing slot count.

**Impact:** More scalable and accurate reporting.

### `scheduledUserStats`

**Current behavior:** Loads users and computes ZIP/referrer stats.

**Findings:**

- `loadUsers()` filters to users with both `referredBy` and `zipCode`, then `totalUsers` is `users.length`.
- That means `totalUsers` is not total users; it is “users with referredBy and zipCode”.
- Full collection read.

**Improvements:**

- Count total users separately from stats-eligible users.
- Include `not-defined` buckets rather than filtering out missing values, or rename metric.
- Page/stream for growth.

**Impact:** Fixes potentially misleading admin dashboard stats.

### `scheduledCheckInStats`

**Current behavior:** Loads check-ins where `inStats == false`, updates aggregate stats and marks check-ins in stats.

**Findings:**

- Uses module-level mutable `stats`.
- `maxInstances: 1` reduces overlap but Cloud Run concurrency/default behavior still makes mutable globals worth avoiding.
- Timezone conversion via `toLocaleString` then `new Date(...)` is fragile.
- Full query of all unchecked check-ins.

**Improvements:**

- Make `stats` local to invocation.
- Set `concurrency: 1` if this function must remain strictly serial.
- Use a reliable timezone library or `Intl.DateTimeFormat` parts.
- Consider transactionally incrementing stats at check-in time.

**Impact:** Prevents race-prone aggregation and timezone bugs.

### Owner operations and retired Pub/Sub maintenance

The eight deployed Pub/Sub maintenance handlers have been removed. Their
replacement consists of four owner-only callables and the private
`ownerOperationWorker` task function.

**Current safeguards:**

- Server authorization requires the immutable `owner` custom claim; ordinary
  administrators cannot invoke the endpoints directly.
- App Check protects deployed callables, and state-changing operations require
  authentication no older than five minutes.
- Previews are single-use, actor/project/arguments-bound, expire after ten
  minutes, and are stored with job/audit records in server-only collections.
- Yearly reset, stats rebuild, and schedule initialization require exact
  project/year/operation phrases and are limited to January 1 through September
  15 in `SHOP_TIME_ZONE`.
- Cloud Tasks execution is serialized with concurrency and maximum instances
  set to one, while Firestore locks reject overlapping jobs.
- Reminder queueing is year-filtered, paginated, previewable, and idempotent.
- Exports are written directly to private Storage objects and exposed only
  through owner-rechecked 15-minute signed URLs; objects expire after seven
  days.
- Schedule initialization uses deterministic year/timestamp IDs, bounded
  batches, and duplicate-safe retries.
- Check-in repair remains available for historical mismatches, while normal
  check-ins update `hasCheckedIn` atomically.
- Check-in stats rebuild replaces the selected-year aggregate from bounded
  source data and synchronizes `inStats` markers instead of incrementing stale
  totals.

**Verified yearly reset behavior:**

- A recent private marketing export must exist before reset preview.
- A fresh full Firestore export must complete successfully before the first
  deletion.
- Resumable stages delete nonstaff Auth users, including disabled customers;
  the approved customer/registration/check-in/queue collections;
  `dateTimeSlots`; and registration QR images.
- Staff and owner accounts, parameters, stats, email templates, private
  exports, and owner operation records are retained.
- Stage cursors and counts make task retries resume rather than restart the
  purge.

**Remaining operational work:**

- Deploy the worker under a dedicated least-privilege service account.
- Add alerts for failed/stalled operations and backup freshness.
- Periodically exercise Firestore restore and QR regeneration procedures.

### `testSeedScenario`

**Current behavior:** Emulator-only helper callable; seeds public parameters by scenario.

**Findings:**

- Runtime guard prevents non-emulator use.
- Exported and deployed unless deploy-time conditional export is added.
- `enforceAppCheck: false`.

**Improvements:**

- Avoid deploying test helpers to production, ideally by separate emulator-only codebase or conditional exports.
- Keep runtime guard as defense-in-depth.

**Impact:** Smaller production attack surface.

### `testSeedPublicParameters`

Same production deployment concern as `testSeedScenario`.

**Impact:** Low if guard is reliable, but unnecessary public endpoint.

### `testClearAllData`

**Current behavior:** Emulator-only helper clears hard-coded Firestore collections and Auth users.

**Findings:**

- Guard is essential and currently present.
- Collection list can drift.
- Deletes all listed docs in one batch per collection; batch limit could exceed 500 docs.

**Improvements:**

- Never deploy to production.
- Use paged deletion for >500 docs even in emulator.
- Consider clearing Storage emulator when needed.

**Impact:** More robust tests and lower production risk.

### `testSeedAdminUser`

**Current behavior:** Emulator-only helper creates admin Auth user with claims.

**Findings:**

- Guard present.
- Requires password.
- Does not write staff doc; depending on admin app expectations, tests might miss staff-document behavior.

**Improvements:**

- Seed staff doc too if app relies on it.
- Keep out of production deploy.

**Impact:** Better E2E fidelity.

### `testSeedDateTimeSlots`

**Current behavior:** Emulator-only helper creates date/time slots.

**Findings:**

- Guard present.
- No schema validation beyond TypeScript shape.
- Fine for test support.

**Improvements:**

- Validate ISO date strings and programYear.
- Keep out of production deploy.

**Impact:** Better test failure messages.

## Dormant/unexported function file

### `scheduledReindexRegistrations`

**Current behavior:** Loads registrations, builds registration search index records, writes transactions in chunks.

**Critical finding:**

- `admin.firestore().runTransaction(...)` is **not awaited** inside the loop.
- That violates Firebase guidance to return/await promises so functions do not terminate before async work completes.

**Impact:** If exported/re-enabled, it can return before writes finish, causing incomplete reindexing and background activity.

**Recommendation:**

- Add `await`.
- Use batches/BulkWriter instead of transactions since it performs no transaction reads.
- Page/stream registrations.
- Add metrics and skipped-record logging.

## Build, deploy, and repo workflow findings

### `lint` script mutates source during deploy

`package.json`:

- `"lint": "eslint --ext .ts . --fix --cache --quiet"`

`firebase.json` predeploy runs lint before build.

**Impact:** Deploying can modify source files. In CI, this can make deployed code differ from committed code, or fail unpredictably.

**Recommendation:**

- Split scripts:
  - `lint`: no `--fix`
  - `lint:fix`: with `--fix`
- Use non-mutating lint in predeploy/CI.

### Deploy scripts use sticky `firebase use`

`deploy:test` and `deploy:prod` run `firebase use ...`.

**Impact:** Sticky project selection can cause local/CI foot-guns.

**Recommendation:**

- Prefer explicit `--project santas-workshop-test` / `--project santas-workshop-193b5`.

### Add `functions.codebase`

This is a monorepo with one Functions source today. Firebase docs recommend codebases to avoid accidental deletion when multiple repos/packages manage functions.

**Impact:** Low today, higher if functions split later.

**Recommendation:**

Add a `codebase`, e.g. `santashop-functions`, under `firebase.json` functions config.

### Source maps may not be emitted by Webpack

`tsconfig.json` enables `sourceMap`, but `webpack.config.mjs` has no `devtool`.

**Impact:** Production stack traces may point into minified/bundled `dist/index.js`.

**Recommendation:**

- Add an appropriate Webpack source-map setting, such as hidden/source maps depending on deployment policy.
- Consider `source-map-support` if useful in Node runtime.

### Consider pinning Functions Framework

Firebase tips recommend explicitly including/pinning Functions Framework so builds do not implicitly use the latest available version.

**Impact:** Lower risk of build/runtime drift.

**Recommendation:**

- Evaluate adding `@google-cloud/functions-framework` as a pinned dependency if applicable to Firebase’s current v2 build flow.

## Remaining implementation roadmap

### Phase 1: Safety and deploy correctness

1. Remove `--fix` from predeploy lint.
2. Assign least-privilege service identities to the owner-operation worker and other high-risk functions before production rollout.
3. Make `scheduledReindexRegistrations` safe or delete it if unused.

### Phase 2: Correctness and idempotency

1. Make registration completion/date changes transactionally authoritative.
2. Harden email outbox retry cutoffs.
3. Add event/queue attempt counters and stuck-state alerts.

### Phase 3: Scalability and cost

1. Replace full-collection reads with pagination/streaming.
2. Replace `offset()` pagination.
3. Use BulkWriter or batched writes for maintenance jobs.
4. Evaluate Cloud Tasks for the remaining email-delivery workflows.
5. Tune CPU/concurrency/max/min instances based on observed traffic.

### Phase 4: Operations

1. Add audit documents for staff/admin/template/destructive functions.
2. Add dashboard/alerts for queue failures, backup freshness, scheduled job runtime, and owner-operation failures.
3. Exercise the documented yearly-reset and restore runbooks regularly.

## Bottom line

The package is already much healthier than many Firebase Functions codebases: v2 APIs, App Check, secret binding, owner-only maintenance operations, tests, and an email outbox model are all wins. The biggest remaining risk is not “bad code” so much as **serverless production sharp edges**: cross-service consistency, service-account scope, and batch jobs that assume seasonal data stays small.

If you want the highest return next, I’d start with:

1. **Runtime/deploy safety:** non-mutating lint.
2. **Security:** least-privilege service identities for high-risk functions.
3. **Correctness:** transactionally enforce slot capacity and authoritative registration state.
4. **Reliability:** add alerts and operational dashboards for the hardened email delivery flow.
