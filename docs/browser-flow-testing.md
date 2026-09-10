# Browser testing: customer and staff flows

Read this guide before browser QA. Use the current repository, deployed UI, and environment configuration as evidence. A previous report is not proof that a flow still works.

## 1. Data safety comes first

| Environment | Allowed test mutations | Cleanup |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Isolated Firebase emulators | Create accounts, assign test roles, seed fixtures, submit and cancel registrations, and exercise destructive flows on fixture data. | Deletion is allowed after checking the emulator host and project. |
| Deployed test: `santas-workshop-test` | Create labeled QA records and roles. Exercise the requested flows. Coordinate shared settings with other testers. | Deletion is allowed after checking the exact test project and targets. Prefer cleanup limited to the run's records. |
| Production: `santas-workshop-193b5` | Read-only by default. Obtain explicit approval before creating QA data, sending messages, assigning permissions, or making other writes. | Never delete production data as test cleanup, including new QA records. |

**Preexisting production data must never be altered or deleted unless the user explicitly instructs that specific change. During November and December, preexisting production data must never be altered or deleted, even when a general testing or maintenance request exists. Use America/Denver to determine the date.**

The November/December restriction also covers indirect changes: check-ins, cancellations, reschedules, child edits, role changes, queued messages, scheduled jobs, imports, and resets that affect existing records. A backup does not waive this restriction. Use emulators or test instead.

“Test all flows” does not authorize production writes or deployment. Outside the active season, an explicit production business-data change is separate from QA cleanup. Confirm its exact records, action, and effects before acting. If the environment is unclear, stop before any write.

For test cleanup, identify records by the run's recorded UIDs and paths, not a broad email substring. A shared test reset can disrupt another agent. Coordinate it first. Account deletion alone may leave registrations, children, QR images, messages, scan attempts, and nested receipts.

Follow the browser tool's confirmation rules for terms, permissions, credentials, and other sensitive actions. Repository permission does not override a required tool confirmation or user handoff.

On September 7, 2026, the user gave standing approval to accept the application's terms for labeled QA signup accounts in `santas-workshop-test` and to continue authorized work through PR completion. Do not ask again for this same approval. Use administrator merge when needed to bypass a PR review requirement, if the account permits it. Record validation and any bypassed gate; do not impersonate a reviewer or weaken branch protection. Production writes and destructive actions remain subject to the explicit boundaries above.

## 2. Establish the target and baseline

1. Read `AGENTS.md`, `.firebaserc`, `firebase.json`, `firebase.e2e.json`, and root scripts in `package.json`.
2. Check `git status --short` before changing generated configuration or running builds. Preserve unrelated work.
3. Record the branch/commit, environment, date, browser, URLs, and visible version.
4. Verify that the relevant app, admin, Functions, and rules deployments completed before deployed QA. A merged PR or green unit suite does not prove deployment.
5. Verify the signed-in account and its roles. Do not assume an existing browser session belongs to the intended test account.
6. Record the program year, available dates, registration flags, and any scheduled reconciliation delay. Overbooking is acceptable. Do not change capacity semantics to make a test pass.

Current target mapping from `.firebaserc`:

| Target | Project | Customer | Admin |
| --------------------------- | ----------------------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| E2E emulators | `demo-santashop` | `http://localhost:4100` | `http://localhost:4100`, sequentially |
| Local development emulators | `demo-santashop` | `http://localhost:4100` | `http://localhost:4101` with `dev:local` |
| Deployed test | `santas-workshop-test` | `https://test.denversantaclausshop.org/` or `https://santashop-app-test.web.app/` | `https://santas-workshop-test.web.app/` |
| Production hosting targets | `santas-workshop-193b5` | Site `santas-workshop-193b5` | Site `santas-workshop-admin` |

Confirm current production domains from Hosting configuration and the user's requested destination. Do not guess a production URL or rely only on a CI-generated link. Firebase hosting target names are not necessarily site names.

For deployed CLI operations, always pass an explicit project. `pnpm exec firebase projects:list` is a useful read-only identity check. Never rely only on the default alias.

## 3. Start an emulator browser session

Use the [E2E guide](testing/e2e.md) for supported commands, exact ports, generated
configuration, targeted specs, fixture APIs, and browser assertions. Read the
`santashop-e2e-testing` skill before integrated emulator testing. Customer and
admin suites share port/state and must run sequentially.

**The callable readiness command clears emulator fixtures. Run it before
seeding, never during a journey or against a deployed site.** Do not point the
emulator suite at a deployed environment by changing `E2E_BASE_URL`; its helpers
are destructive and emulator-only. Use the deployed procedure below instead.

## 4. Create accounts and assign permissions

Use unique labels such as `QA <date> <run> <purpose>`. For deployed test, use aliases of the approved mailbox, for example `joelmeaders+qaYYMMDDc@gmail.com`. Keep aliases short enough for the current form and backend validators. Do not use somebody else's mailbox or real child details.

Create at least these identities:

| Identity | Claims | Purpose |
| -------------- | --------------------------------------------- | --------------------------------------------------------- |
| Customer | No staff role, no owner claim | Public journeys and denied staff access |
| Check-in staff | `roles: ['checkin']`, `owner: false` | Front-desk workflows without admin privileges |
| Admin | `roles: ['admin', 'checkin']`, `owner: false` | Admin tools without owner capability |
| Owner | `roles: ['admin', 'checkin']`, `owner: true` | Owner-only preview and isolated protected-operation tests |

Do not test only with an owner account. It can hide missing staff permissions. Never assign `admin` merely to bypass a failed check-in test.

### Emulator accounts

Use the [E2E fixture APIs](testing/e2e.md#fixtures-and-supported-user-flows), with
disposable data and explicit roles. Omitted staff roles can default to admin
and check-in; do not use those defaults for permission-denial tests. UI signup
must still be exercised when testing signup—API seeds do not prove that flow.

### Deployed test accounts

Create customers through the public sign-up UI when testing onboarding. For staff, prefer an existing authorized administrator's **User Management** UI. Create a uniquely labeled account and select only the required roles. Confirm the resulting Auth identity and staff record.

If no bootstrap administrator exists, an authorized operator can use Firebase Admin SDK tooling with approved credentials. Before every privileged write:

1. Hard-code or explicitly pass `santas-workshop-test` and verify it against `.firebaserc` and the authenticated project list.
2. Assert that no emulator environment variable is unexpectedly routing the request elsewhere.
3. Resolve the exact QA email and UID. Do not modify an unrelated existing identity.
4. Create the Auth account if needed. Preserve unrelated custom claims when calling `setCustomUserClaims`.
5. Maintain the matching `staff/{uid}` record using the current staff callable schema. An Auth account alone is not a complete staff setup.
6. Sign out and back in through the UI so the browser receives fresh claims. Check the permitted and denied routes.

Prefer the current `callableCreateStaffUser` and `callableUpdateStaffUser` workflows over ad hoc database writes. They maintain the application's validation and metadata. Review their current schema before using them.

For an explicitly authorized owner bootstrap, the repository provides:

```text
node santashop-functions/scripts/manage-owner.mjs grant --project santas-workshop-test --confirm-project santas-workshop-test --uid <verified-QA-UID>
```

This script uses Application Default Credentials. Firebase CLI login alone does not supply ADC. It grants owner/admin/check-in claims and merges the staff record. It does **not** enforce the production seasonal policy in this guide. Never use it as a production QA shortcut. Do not transfer or revoke an existing owner's access to make room for a test account.

If approved credentials are unavailable, ask for the required operator action. Never print, commit, or copy refresh tokens, ID tokens, service-account keys, or passwords into notes, documents, screenshots, or reports. Do not teach future agents to extract credentials from private CLI internals.

For production, account creation and permission changes require separate explicit approval. Preexisting production identities are protected by the same November/December restriction as customer records.

## 5. Browser procedure and evidence

Use the browser tool and skill available in the session. If the user names Chrome, stay in Chrome. Do not replace live browser evidence with API calls or mocked screenshots.

- Observe the current DOM/accessibility tree before acting. Ionic route and modal transitions can briefly expose old and new controls together.
- After an action, wait for a visible result or navigation. Reobserve after a timeout before choosing a new locator. Never blindly repeat a submit button.
- Prefer labels, roles, and stable IDs. Password/email accessibility values may be redacted; verify validation and outcomes without publishing credentials.
- Record the QR image source or code before rescheduling/cancelling. Compare the same registration after each transition and after reload/sign-in.
- Inspect console and network failures. Separate app errors from browser-extension errors, expected invalid-login responses, and unsupported-host App Check failures.
- Verify current version on both sites. On a stale-chunk error, record the failing URL and caching evidence. A cache-disabled success is not proof that ordinary post-deployment reloads are safe. Restore temporary browser overrides.
- Use domains allowed by both Firebase Auth and App Check. A working alternate Firebase hostname is not necessarily an authorized application origin. Do not disable App Check to force QA through.
- Keep an evidence row for every journey: environment, role, record, action, expected result, actual result, and evidence. Mark blocked/not-run explicitly.

## 6. Complete journey matrix

Run destructive, error-injection, and shared-setting cases in emulators first. In test, use the labeled QA records. In production, perform only the authorized subset under section 1.

| Area | Checks and required evidence |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry and status flags | Account creation enabled/disabled, registration closed, maintenance/weather alerts, loading/error/retry states, English/Spanish. Seed flags in emulators; do not toggle shared production settings. |
| Sign-up | Required fields, malformed and long email, password mismatch, ZIP/referral validation, listed and Other referral, terms, newsletter opt-in/out, duplicate email, email confirmation, successful persisted account. |
| Authentication | Signed-out protected URLs, correct/incorrect credentials, sign-out, safe return URL, session reload, password-reset request. Distinguish request acknowledgment from inbox receipt and final password replacement. Follow credential handoff rules. |
| Account | Name/ZIP changes, email-change reauthentication, password-change validation, persistence after reload. Verify old/new sign-in behavior only when credential changes are permitted. |
| Children | Add/edit/remove, multiple children, age boundary, missing/invalid dates, toy preference, cancelled modal, persisted values, prerequisite gating. |
| Scheduling | Available/disabled/full slots, selection, changed availability, reschedule, backend failure and retry, state after reload. Preserve the project's soft-capacity policy. |
| Submission | Review all children, appointment, email confirmation, one successful submit, repeated/double submit, error recovery, ticket/QR, event/help/map links. |
| Cancellation and re-registration | Cancel only the QA record, confirm appointment release and UI state, try its code while cancelled, resubmit if slots exist, verify stable QR identity and current-state scan behavior. Never infer this result from rescheduling alone. |
| Staff access | Customer denial; check-in-only, ordinary admin, owner roles; hidden controls and direct-route denial; permitted data reads and server-side writes. Refresh claims before judging results. |
| Staff searches | Email, name+ZIP, exact code, empty results, sorting, retry/error state, correct detail route. Verify each with check-in-only as well as admin. |
| Check-in | Camera permission/denial/no-device states, real camera decode where available, manual code, invalid/cancelled code, child review/edit, correct coupon count, success. API lookup is not camera-scan evidence. |
| Duplicate scans | Immediate accidental duplicate, later risk duplicate, original event preservation, no extra coupons/check-in, admin-only risk list and timeline. Do not sleep through a threshold when emulator fixtures can model it. |
| Staff pre-registration | Referral, language, children, appointment, duplicate/invalid email, submitted registration, account creation, queued confirmation, retry behavior. |
| On-site registration | Required fields, children, referral, newsletter state, successful check-in/coupons, repeated submit handling. |
| Email operations | Single-recipient resend for complete/incomplete/missing QA accounts, queued state, actual delivery only with mailbox evidence. No broad sends during QA. |
| Schedules | Load/filter year, generation, inline/bulk edits, enabled state, delete confirmation and persistence. Perform writes/deletes only on isolated emulator/test fixtures. |
| Templates | List, create/import, edit fields, preview/sample mapping, plain text, revision save/load, test recipient, publish/delete safeguards. Use isolated test templates; never overwrite a shared published template for convenience. |
| Staff management | Create/update/disable/delete a disposable QA identity, claims refresh, self/last-owner protections, unauthorized operations. Production identities remain protected. |
| Owner operations | Preview, reauthentication, exact phrase, allowed date window, execution/audit/error paths. Execute destructive cases only in emulators/test. Preview is not execution evidence. |
| Statistics | Registration/check-in/user reports, year changes, refresh/empty/error states, chart labels, scan-risk pagination/timeline. Compare timestamps and documented reconciliation schedules, not immediate totals alone. |
| Presentation | Requested desktop/mobile widths, scrolling, keyboard focus, modal focus/return, validation announcements, contrast/overflow, complete Spanish journey where in scope. Restore viewport/theme changes. |

## 7. Finish and report honestly

### Service-worker update checks

Use a dedicated local production-build preview or an approved test deployment for service-worker lifecycle checks. Ordinary emulator E2E and Storybook sessions must keep service workers disabled.

1. Load release A and wait for its service worker to control the page.
2. Enter unsaved form data. Publish release B only to the authorized test target or replace files in the isolated local preview.
3. Trigger an update check. Confirm the update prompt appears only after release B is ready.
4. Select Not now. Confirm the current form and release A remain usable.
5. Reload after release B is ready. Confirm the visible version and loaded bundles belong to release B.
6. Repeat with the prompt's Refresh page action. Confirm the warning explains possible loss of unsaved input.
7. Check offline, failed-download, multiple-tab, and unrecoverable-version cases. No case may cause a reload loop or automatic form loss.
8. Inspect Cache Storage. Confirm it contains application assets, not customer records, Auth/Firestore/Functions responses, or personalized QR files.

A refresh cannot guarantee a release that the browser has not downloaded. Distinguish latest downloaded version from latest deployed version. Never count an ordinary development-server reload as service-worker evidence.

Service-worker removal needs a tested rollback plan. Reverting registration code alone does not remove workers already installed in browsers. An authorized rollback can serve Angular's safety worker at the original worker URL. Verify that a missing manifest is a real 404, not the SPA rewrite's HTML response, before relying on manifest removal. See [Angular's service-worker recovery guidance](https://angular.dev/ecosystem/service-workers/devops#service-worker-safety). These client-cache procedures never authorize deleting application business data.

### Test results and handoff

Create dated QA reports directly in the Obsidian project's `Archive/QA` folder.
Follow the [recording policy](README.md#recording-future-work) for the exact path,
evidence fields, and generated artifacts. Do not add hosted QA reports or run
logs to repository documentation.

Run scoped unit/build/rules checks for fixes. The Storybook workflow runs the behavioral suite once, separately from the app/admin unit commands; it does not replace Firebase browser journeys. Use `ci:storybook` and relevant visual checks when shared UI behavior changes.

Separate results into emulator, deployed test, and production evidence. Record limitations such as unavailable camera, missing mailbox access, protected production data, or pending approval. Do not describe page rendering as a successful mutation, queued mail as delivered mail, or API seeding as UI onboarding.

Report defects with reproduction steps, role/environment, visible result, and relevant logs. Keep secrets and unnecessary personal data out of artifacts. List retained QA records and cleanup performed. Never delete production QA records during cleanup.

Stop only processes owned by this run. Restore temporary configuration and browser overrides without discarding others' changes. Leave no untracked background agent writes. A successful local fix still needs its authorized deployment and a fresh deployed retest.
