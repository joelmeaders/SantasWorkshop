## Summary

I analyzed `santashop-functions` end-to-end against current Firebase/Google Cloud guidance. I did **not modify files**.

The project is in decent shape overall: it is fully on Firebase Functions v2 APIs, avoids deprecated `functions.config()`, uses App Check for deployed callables, has emulator-gated test helpers, and has meaningful unit/integration coverage. The biggest improvement opportunities are around **runtime support verification, idempotency/retries, least-privilege service accounts, full-collection job scalability, stronger server-side validation, and consistency across Auth/Firestore/Storage/SES side effects**.

I reviewed guidance from:

- Firebase Cloud Functions overview, management, config/env, tips, retries, callable functions, Firestore triggers, scheduled functions, Pub/Sub triggers, locations, quotas, TypeScript, networking, task queues, App Check.
- Google Cloud Run / Cloud Run functions guidance for concurrency, max/min instances, startup/cold starts, temporary files, service identity, and scaling behavior.

## Current functions inventory

`src/index.ts` exports **40 deployable functions**:

| Category | Count | Functions |
|---|---:|---|
| Production callable functions | 21 | `changeAccountInformation`, `updateReferredBy`, `completeRegistration`, `newAccount`, `undoRegistration`, `changeRegistrationDateTime`, `updateEmailAddress`, `checkIn`, `checkInWithEdit`, `onSiteRegistration`, `callableAdminPreRegister`, `callableResendRegistrationEmail`, `callableListEmailTemplates`, `callableGetEmailTemplate`, `callableGetEmailTemplateRevision`, `callableSaveEmailTemplateRevision`, `callablePublishEmailTemplate`, `callableSendTestEmailTemplate`, `callableCreateStaffUser`, `callableUpdateStaffUser`, `callableDeleteStaffUser` |
| Firestore trigger | 1 | `sendNewRegistrationEmails` |
| Scheduled functions | 5 | `scheduledFirestoreBackup`, `scheduledDateTimeSlotCounters`, `scheduledRegistrationStats`, `scheduledUserStats`, `scheduledCheckInStats` |
| Pub/Sub functions | 8 | `pubsubResetCheckInStats`, `pubsubQueueReminderEmails`, `pubsubSetAdminRights`, `pubsubMarkRegistrationsCheckedIn`, `pubsubExportMarketingEmails`, `pubsubExportRegisteredEmails`, `pubsubAddDateTimeSlots`, `pubsubDeleteUsers` |
| Emulator-only helper callables | 5 | `testSeedScenario`, `testSeedPublicParameters`, `testClearAllData`, `testSeedAdminUser`, `testSeedDateTimeSlots` |

There are also **2 unexported/dormant handlers** in `src/fn/`:

- `scheduledReindexRegistrations`
- `pubsubCreateNewEmailTemplate`

## What is already strong

- **Firebase v2 migration is complete.** I found no `firebase-functions/v1` or `functions.config()` usage in `santashop-functions/src/**`.
- **App Check is enforced for production callables** via `ENFORCE_APP_CHECK = process.env.FUNCTIONS_EMULATOR !== 'true'`.
- **AWS secrets are bound only to AWS-email functions** in `index.ts`.
- **Dynamic imports in `index.ts` reduce cold-start blast radius** by deferring handler-specific dependencies until invocation.
- **Many state-changing admin callables check custom claims** before proceeding.
- **Email sending has an outbox-like queue document model**, including `queued`, `sending`, `sent`, `failed`, stale sending repair, and registration repair.
- **Tests exist and are modernized** with Vitest plus emulator-backed integration tests.
- **Generated `.env.*` files appear ignored**, and `git ls-files` only showed `.env.example` as tracked.

## Highest-impact recommendations

| Priority | Improvement | Impact |
|---|---|---|
| Critical | Verify Firebase runtime support for `engines.node: "24"` | Prevent failed deploys if Firebase runtime does not support Node 24 in the target project/CLI combination |
| Critical | Make retrying external-side-effect functions fully idempotent | Reduces duplicate emails and retry-loop risk |
| High | Add explicit `region`, `serviceAccount`, and selected runtime options | Improves latency predictability, security, cost control, and deploy reproducibility |
| High | Replace dangerous manual Pub/Sub jobs with safer gated workflows | Reduces blast radius of accidental admin password resets or mass user deletion |
| High | Move large batch jobs from full-collection reads to paginated/streamed/task-queue flows | Prevents timeouts, memory growth, and high Firestore read costs as data grows |
| High | Enforce authoritative server-side reads/transactions for registration, slot capacity, and check-in flows | Prevents client-tampering, overbooking, and inconsistent stats |
| Medium | Convert env configuration to Firebase parameterized config / `defineSecret` | Better deploy-time validation, safer secret access, fewer discovery-time surprises |
| Medium | Clean up temporary files or avoid temp files for CSV exports | Prevents memory leaks/OOM cold starts |
| Medium | Improve callable validation and HttpsError mapping | Better client errors and fewer generic `internal` responses |
| Medium | Stop using `--fix` in predeploy lint | Avoids deploy-time mutation of source files |

## Cross-cutting findings

### 1. Node.js 24 runtime support should be verified before production deploy

`package.json` sets:

- `engines.node = "24"`

The Firebase docs I fetched list Cloud Functions supported Node.js runtimes as **22**, **20**, and deprecated **18**. This conflicts with the repo’s Node 24 floor.

**Impact:** If the active Firebase CLI/runtime does not support Node 24 for Cloud Functions in your project, deploys can fail even though local builds/tests pass.

**Recommendation:**

- Verify with a targeted deploy to the test Firebase project before production.
- If deploy fails due runtime support, set Functions runtime to Node 22 until Firebase docs/CLI/runtime fully support Node 24.
- If Node 24 is intentionally supported in your project through newer tooling, document that in `santashop-functions/README.md` with the minimum Firebase CLI version.

### 2. Add explicit regions everywhere

No exported function in `src/index.ts` currently sets `region`.

Firebase guidance encourages explicit regions because defaults can change, and latency/cost depend on proximity to Firestore, Storage, Pub/Sub, and users.

**Impact:**

- Avoids accidental region drift.
- Makes Hosting rewrites and callable client initialization predictable.
- Reduces latency between Functions and Firestore/Storage if colocated.

**Recommendation:**

- Define a shared runtime option, probably `region: 'us-central1'` if that matches current deploy/client assumptions.
- If Firestore/Storage are in a different region/multi-region, choose the nearest recommended Functions region.
- If changing region for existing production functions, follow Firebase’s safe migration sequence: deploy renamed/new-region functions, verify, then delete old ones.

### 3. Use dedicated least-privilege service accounts

All functions appear to run under the default 2nd-gen compute service account. Several functions have very different privilege profiles:

- Account creation/deletion: `newAccount`, `callableAdminPreRegister`, staff functions, `pubsubDeleteUsers`
- Admin bootstrap: `pubsubSetAdminRights`
- Email sending/publishing: `sendNewRegistrationEmails`, template callables
- Stats/export jobs: scheduled and Pub/Sub background jobs
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
- Especially isolate `pubsubDeleteUsers` and `pubsubSetAdminRights`.

### 4. Consider `setGlobalOptions`

Many function options are repeated or omitted. Firebase v2 allows global defaults.

**Impact:**

- Fewer copy/paste misses.
- Easier to enforce region, service account, max instances, CPU, memory, timeout, labels.

**Recommendation:**

Use `setGlobalOptions` for common defaults, then override per heavy function.

Likely defaults to evaluate:

- `region`
- `cpu: 'gcf_gen1'` for low-traffic low-memory functions if cost matters
- conservative `maxInstances`
- `concurrency` tuned by function type
- labels for cost ownership

### 5. Revisit v2 CPU/concurrency/cost settings

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

### 6. Move env configuration toward Firebase params/secrets

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

### 7. Add observability and structured logging

Most handlers use `console.log` / `console.error`.

Firebase examples now commonly use `firebase-functions/logger` so logs are structured and easier to query.

**Impact:**

- Easier incident triage.
- Better filtering by function, user ID, queue doc ID, registration ID, delivery state, and operation type.
- Cleaner Error Reporting integration.

**Recommendation:**

- Use `logger.info`, `logger.warn`, `logger.error`.
- Include structured fields like `{ uid, functionName, queueDocId, templateKey, deliveryState }`.
- Add alerting for:
  - repeated `sendNewRegistrationEmails` failures
  - backup export failures
  - mass delete/admin bootstrap invocation
  - scheduled stats timeout
  - queue docs stuck in `sending`

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
- Wrap user-visible failures in `HttpsError('invalid-argument', ...)`.
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

**Current behavior:** Admin-only callable creates a `checkins/{uid}` record from client-supplied partial registration.

**Findings:**

- Good: admin check.
- Good: `create()` makes duplicate check-ins fail.
- Risk: stats are computed from client-supplied registration fields, not authoritative Firestore registration.
- Does not immediately mark the registration as checked in; later `pubsubMarkRegistrationsCheckedIn` does that.

**Improvements:**

- Load registration by UID from Firestore before writing check-in.
- Use a transaction to create check-in and mark registration `hasCheckedIn`.
- Keep client edits separate from authoritative persisted state.

**Impact:** Prevents tampered check-in stats and removes lag between check-in and registration state.

### `checkInWithEdit`

**Current behavior:** Admin creates edited registration snapshot and check-in.

**Findings:**

- Good: admin-only and duplicate protection via `create`.
- Risk: trusts edited registration payload.
- Does not immediately update original registration `hasCheckedIn`.
- Batch create is good, but no authoritative validation against existing registration.

**Improvements:**

- Validate edited data with a schema.
- Load existing registration and write check-in + status in one transaction/batch.
- Consider preserving original-vs-edited diff for auditability.

**Impact:** Better data trust and audit history.

### `onSiteRegistration`

**Current behavior:** Admin creates onsite registration and check-in.

**Findings:**

- Good: admin-only.
- Potential inconsistency: check-in doc ID is generated `id`, but `checkin.customerId` is set to `record.uid`, while registration’s `uid` is overwritten to `id`.
- Uses client-supplied registration data.
- Onsite check-ins are excluded from `pubsubMarkRegistrationsCheckedIn` by `customerId != onsite`, but here `customerId` may not be `'onsite'`.

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
- Use structured logging for admin actions if needed.

**Impact:** Low; mainly future-proofing.

### `callableGetEmailTemplate`

**Current behavior:** Admin gets summary, revisions, and current HTML.

**Findings:**

- Good: admin-only.
- Validation helpers like `normalizeEmailTemplateKey` throw plain `Error`, which may surface to clients as generic `internal` instead of `invalid-argument`.

**Improvements:**

- Convert validation errors to `HttpsError('invalid-argument', ...)`.
- Consider limiting revision count or lazy-loading revision HTML.

**Impact:** Better client UX and scalability.

### `callableGetEmailTemplateRevision`

**Current behavior:** Admin gets one revision and HTML.

**Findings:**

- Good: admin-only and clear not-found errors.
- Same validation error mapping issue.

**Improvements:**

- Wrap normalization/validation errors as `HttpsError`.
- Add audit logging for template revision reads if templates are sensitive.

**Impact:** Better diagnostics.

### `callableSaveEmailTemplateRevision`

**Current behavior:** Admin saves HTML to Storage and writes template/revision metadata in Firestore transaction.

**Findings:**

- Good: deletes Storage object if Firestore transaction fails.
- Good: validates mappings before saving.
- Validation functions can throw plain `Error` before the `try` block.
- Writes Storage before Firestore transaction; if process crashes after Storage write but before transaction, orphaned HTML can remain.

**Improvements:**

- Wrap all validation in `try` and return `invalid-argument`.
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
- Return a clean `invalid-argument` for validation errors.

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

**Current behavior:** Admin creates Auth staff user, sets claims, writes staff doc.

**Findings:**

- Good: validates email, display name, password, roles.
- Good: forces `admin` to also include `checkin`.
- If setting claims or writing Firestore fails, deletes Auth user.
- Staff password is passed through callable request.

**Improvements:**

- Prefer invite/password reset link instead of admin-provided password.
- Audit actor UID/email.
- Use a reconciliation job to detect Auth staff users missing staff docs or vice versa.
- Consider custom claims update before/after Firestore consistency guarantees.

**Impact:** Better staff account security and recoverability.

### `callableUpdateStaffUser`

**Current behavior:** Admin updates Auth profile/password/disabled, claims, and Firestore staff doc.

**Findings:**

- Good: prevents removing admin from protected UIDs.
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

**Current behavior:** Admin deletes Auth user and staff doc.

**Findings:**

- Good: blocks protected UIDs and self-deletion.
- Auth deletion happens before Firestore deletion; Firestore failure leaves stale staff doc.

**Improvements:**

- Disable Auth user first, delete staff doc, then delete Auth user; or write a tombstone.
- Add audit metadata before deletion.
- Add reconciliation for staff docs without Auth users.

**Impact:** Safer account lifecycle.

### `sendNewRegistrationEmails`

**Current behavior:** Firestore `onDocumentCreated` for `tmp_registrationemails/{docId}`, with AWS secrets, `retry: true`, `maxInstances: 1`, delegates to `sendNewRegistrationEmails2`.

**Findings:**

- Good: retry enabled for transient SES/Firestore failures.
- Good: handler tracks `queued`, `sending`, `sent`, `failed`, stale sending repair, and registration repair.
- Firebase retry guidance says retrying event-driven functions must be idempotent. This function is close, but external SES sends cannot be made perfectly idempotent with current state.
- If the function sends via SES and crashes before persisting `sent`, retry/stale recovery can send a duplicate email.
- No explicit event-age cutoff or dead-letter strategy.
- `maxInstances: 1` limits SES pressure but can create backlog.

**Improvements:**

- Store event IDs / attempt IDs if available from the Firestore event wrapper.
- Add attempt count and max retry age on queue doc.
- Consider Cloud Tasks for email delivery with explicit retry config and rate limits.
- Consider a “manual review” state after repeated failures instead of endless re-trigger/repair.
- Add alerting on `failed` and long-lived `sending`.

**Impact:** Reduces duplicate-email and stuck-queue risk.

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

### `pubsubResetCheckInStats`

**Current behavior:** Sets all check-ins `inStats: false`.

**Findings:**

- Full collection read.
- Uses transactions for write batches but no reads inside transactions; regular batches/BulkWriter would be simpler.
- Manual operation could be destructive to stats if accidentally triggered.

**Improvements:**

- Require message payload confirmation if kept as Pub/Sub.
- Use BulkWriter/pagination.
- Log actor/source metadata through Pub/Sub attributes.

**Impact:** Safer manual maintenance.

### `pubsubQueueReminderEmails`

**Current behavior:** Full reads registrations ordered by `registrationSubmittedOn`, filters eligible reminder emails, writes queue docs transactionally.

**Findings:**

- Good: transaction rechecks queue and registration state.
- Good: skips already sent/queued/failed and QR-not-ready records.
- Full collection read and in-memory filter.
- Query orders by submitted date but does not filter to completed/program year.
- Failed queueing sets `reminderEmailFailedOn`, which then prevents future queue attempts.

**Improvements:**

- Query only eligible records where possible: submitted, current year, not queued/sent/failed.
- Page/stream.
- Use Cloud Tasks for per-email rate limits/retries.
- Differentiate permanent failed from transient queueing failure.
- Add dry-run/count mode.

**Impact:** Avoids timeout and makes reminders reliable at larger scale.

### `pubsubSetAdminRights`

**Current behavior:** For each `ADMIN_UIDS`, resets password to `ADMIN_BOOTSTRAP_PASSWORD`, enables account, sets admin/checkin claims, writes staff doc.

**Findings:**

- Very high-impact administrative function.
- If topic publishing permission is too broad, triggering this resets protected admin passwords.
- Storing and reusing bootstrap password is risky, even though placeholder detection exists.
- Runs sequentially and mutates Auth/staff docs.

**Improvements:**

- Replace with a local/CI-only one-time script, not deployed Pub/Sub.
- Prefer Firebase password reset links or manual claims management.
- If retained, require signed payload with one-time nonce and environment guard.
- Restrict Pub/Sub publisher IAM to a break-glass service account.
- Add alerting on every invocation.

**Impact:** Major reduction in account takeover/blast-radius risk.

### `pubsubMarkRegistrationsCheckedIn`

**Current behavior:** Loads check-ins where `customerId != onsite`, marks matching registration docs `hasCheckedIn: true`.

**Findings:**

- Full query.
- Eventual consistency: registration state lags after check-in.
- Depends on `customerId` semantics being consistent.
- Could be replaced by transaction at check-in time.

**Improvements:**

- Mark registration checked-in in `checkIn` / `checkInWithEdit` transaction.
- Keep this as repair job only.
- Page/stream if retained.

**Impact:** Improves real-time correctness and removes a manual maintenance dependency.

### `pubsubExportMarketingEmails`

**Current behavior:** Queries newsletter users, converts to CSV, writes temp file, uploads to Storage with download token.

**Findings:**

- Uses `/tmp` and never deletes the temporary file.
- Firebase docs warn temp files can persist between invocations and consume memory.
- Full result set in memory.
- Download token makes object accessible to anyone with URL.

**Improvements:**

- Use `bucket.file(...).save(output)` directly or delete temp file in `finally`.
- Put exports under a clear folder and lifecycle policy.
- Consider signed URLs with expiry instead of persistent download token.
- Page/stream for large exports.

**Impact:** Prevents OOM/cold starts and reduces data exposure risk.

### `pubsubExportRegisteredEmails`

Same findings as `pubsubExportMarketingEmails`, but source is completed registrations.

**Additional note:**

- Query `where('registrationSubmittedOn', '!=', '')` is a loose sentinel. Prefer explicit `programYear` and submitted timestamp presence/status fields.

**Impact:** Better export safety and accuracy.

### `pubsubAddDateTimeSlots`

**Current behavior:** If any `dateTimeSlots` exist, does nothing; otherwise creates slots for configured days/hours.

**Findings:**

- Checks the whole collection, not current `PROGRAM_YEAR`.
- Non-idempotent doc IDs from `.add()`.
- Duplicate or partial setup recovery is awkward.

**Improvements:**

- Query by `programYear`.
- Use deterministic doc IDs, e.g. `${PROGRAM_YEAR}-${day}-${hour}`.
- Upsert missing slots instead of all-or-nothing “collection empty”.
- Add dry-run/log summary.

**Impact:** Safer annual setup and recovery.

### `pubsubDeleteUsers`

**Current behavior:** Deletes all non-disabled, non-elevated Auth users, up to an abort threshold.

**Findings:**

- Very dangerous production operation.
- No dry-run.
- No required payload confirmation.
- No project/environment safeguard beyond protected/elevated filtering.
- Deletes Auth users only; Firestore user/registration cleanup is not shown.
- Uses `sleep(3000)` inside function; okay technically, but Cloud Tasks is cleaner for long/rate-limited operations.

**Improvements:**

- Convert to a secured admin-only callable or CLI script with confirmation.
- Add dry-run mode and output target list/count.
- Require payload like `{ confirmProjectId, confirmPhrase, maxUsers }`.
- Delete/disable in batches with Cloud Tasks.
- Add audit log and alerting.
- Reconcile Firestore documents or explicitly document that this is Auth-only.

**Impact:** Reduces catastrophic accidental deletion risk.

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

## Dormant/unexported function files

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

### `pubsubCreateNewEmailTemplate`

**Current behavior:** Creates a hard-coded SES template from a local HTML file.

**Findings:**

- Not exported.
- Hard-coded region `us-west-2`; should use `SES_REGION`.
- Hard-coded 2025 subject.
- Reads `src/utility/assets/registration-confirmation-2023.html`, which may not exist in deployed bundle as expected.
- Superseded by newer email template management callables.

**Recommendation:**

- Delete if obsolete, or update and export intentionally.
- Prefer the current template management workflow.

**Impact:** Removes dead code/confusion.

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

## Suggested implementation roadmap

### Phase 1: Safety and deploy correctness

1. Verify/resolve Node 24 Firebase runtime support.
2. Remove `--fix` from predeploy lint.
3. Add explicit region.
4. Add service accounts for high-risk functions.
5. Lock down or remove `pubsubSetAdminRights` and `pubsubDeleteUsers`.
6. Make `scheduledReindexRegistrations` safe or delete it if unused.

### Phase 2: Correctness and idempotency

1. Make registration completion/date changes transactionally authoritative.
2. Move check-in + `hasCheckedIn` marking into one transaction.
3. Harden email outbox idempotency and retry cutoffs.
4. Add event/queue attempt counters and stuck-state alerts.
5. Add validation wrappers so all bad client inputs return `invalid-argument`.

### Phase 3: Scalability and cost

1. Replace full-collection reads with pagination/streaming.
2. Replace `offset()` pagination.
3. Use BulkWriter or batched writes for maintenance jobs.
4. Evaluate Cloud Tasks for email queueing, user deletion, exports, and long-running batch operations.
5. Tune CPU/concurrency/max/min instances based on observed traffic.

### Phase 4: Observability and operations

1. Convert logs to structured `firebase-functions/logger`.
2. Add audit documents for staff/admin/template/destructive functions.
3. Add dashboard/alerts for queue failures, backup freshness, scheduled job runtime, and Pub/Sub errors.
4. Document manual runbooks for maintenance functions.

## Bottom line

The package is already much healthier than many Firebase Functions codebases: v2 APIs, App Check, secret binding, tests, and an email outbox model are all wins. The biggest risk is not “bad code” so much as **serverless production sharp edges**: retries with external side effects, privileged maintenance functions, cross-service consistency, and batch jobs that assume seasonal data stays small.

If you want the highest return next, I’d start with:

1. **Runtime/deploy safety:** Node 24 verification + non-mutating lint.
2. **Security:** per-function service accounts + lock down/delete dangerous Pub/Sub maintenance functions.
3. **Correctness:** transactionally enforce slot capacity and authoritative registration/check-in state.
4. **Reliability:** harden email idempotency/retry handling and add alerts.
