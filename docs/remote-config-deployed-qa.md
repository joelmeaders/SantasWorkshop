# Remote Config deployed release QA

Run started September 7, 2026. The user authorized test environment repair,
blocking code fixes through a pull request, and production deployment after test
validation. The starting merged commit is
`e3f20e059fead009b3d60af9ceccfa7c3796507c` (PR #160).

## Environment and evidence boundaries

- Test project: `santas-workshop-test`.
- Customer: `https://test.denversantaclausshop.org/`.
- Admin: `https://santas-workshop-test.web.app/`.
- Browsers: Chrome and the Codex in-app browser.
- Use new, labeled QA accounts. The existing Chrome customer session is not
  verified as disposable and must not be changed by this run.
- Production customer records and existing identities are outside this QA run.
- Mail queue acknowledgment is not proof of delivery. Camera permission or
  manual-code success is not proof of camera decoding.

## Deployment baseline

| Component | Workflow run | Result |
| --- | --- | --- |
| Customer | 34149572084 | Passed |
| Admin | 34149572079 | Passed |
| Functions and rules | 34149572134 | Tests passed; deploy blocked by quota before live changes |

The first admin page inspection showed `2026.09.0-beta.2`. Deployed acceptance
must wait for the intended versions and backend deployment.

## Journey evidence

| Area | Roles and checks | Result |
| --- | --- | --- |
| Entry controls | English/Spanish, registration, account creation, maintenance, weather and global alert | Bilingual maintenance/global alert displayed; weather delivered without reload in the 16–42 second observation interval; account-creation-off changed the underlying home; stale closure overlay defect found |
| Authentication | Invalid login, protected routes, sign-in/out, reload, password reset request | Invalid login, sign-in/out and reload passed; password reset pending |
| Onboarding | Field validation, referral, consent controls, persisted customer | Not run |
| Account | Name/ZIP edit, validation, persistence | Name/ZIP update and reload passed; short ZIP rejected with translated message |
| Children | Add/edit/remove disposable children, ages, preferences, cancel modal | Add, edit and remove passed; age 0–2 omitted toy choice; one valid child enabled scheduling |
| Registration | Date selection, review, submit, ticket, reschedule, cancel/re-register, QR identity | Appointment flows passed; reschedule retained QR; cancel/re-register rotated code, contrary to documented stable-code requirement; investigation pending |
| Staff authorization | Customer, check-in, ordinary admin, owner routes and controls | Not run |
| Staff search | Email, name/ZIP, code, no matches, detail | Email and name/ZIP found the isolated household; current code opened its detail |
| Check-in | Invalid/cancelled code, review, coupons, success, duplicate protection | Invalid/cancelled code rejection, success with one coupon and immediate duplicate protection passed; physical camera decoding unavailable |
| Staff registration | Pre-registration and on-site registration with disposable data | Owner pre-registration and on-site registration passed; check-in-only UI exposed forbidden registration links, repair pending deployment |
| Email | Single QA recipient resend and queue state | Not run |
| Schedules | Read, year/filter, isolated fixture create/edit/delete | Read/year filtering passed; past-year generation rejected; current-year initialization confirmation cancelled without mutation |
| Templates | Isolated draft create/edit/preview/revision and safeguards | QA template created, revision 1 published and loaded over revision 2 draft; preview and cancel-delete passed; test-send acknowledged, delivery unverified |
| Staff management | Disposable identity lifecycle and claims refresh | List/refresh and isolated staff display-name edit passed; permission changes and password changes not exercised |
| Owner settings | Read, publish, conflict, real-time delivery, backend convergence, restore | Read/publish/conflict passed after repairs; live delivery stalled after initial success; watchdog repair awaiting deployment; version 48 restored original version 41 values |
| Owner operations | Preview and safeguards; do not reset shared test data | Preview passed; no reset executed |
| Statistics | Reports, year/filter, refresh and scan-risk details | Registration/check-in/user reports read successfully; cancelled-code timeline showed the correct isolated customer |
| Presentation | Desktop/mobile, keyboard/modal behavior, Spanish | Spanish ticket, event details, account menu and help modal inspected; mobile and full keyboard checks pending |
| Update recovery | Visible version, reload, cache boundaries and download failure behavior | Update prompt reload completed and dismissed the prompt; custom-origin sign-in later stalled with reCAPTCHA asset HTTP 504; same credentials worked immediately on fresh Hosting origin |

## Release status

Production is not deployed by this run. The quota repair uses a private singleton
gateway with no persistent settings copy and unchanged consumer capacity. It is
deployed to test. Six sampled gateway requests returned HTTP 200 in 165–214 ms;
this is smoke evidence, not a load test. Remaining repairs and live validation
are in progress. No skipped or blocked journey counts as passed.

Admin deployment completed at 18:05 UTC. The user cleared the browser cache; the next DOM inspection showed beta.3. This verifies the version after cache clearing, not normal update recovery.

Test fixture bootstrap: UID qa-rc-20260907-owner, owner=true and roles admin/checkin. Exact project number 312672416598 was checked before writes. Auth and staff creation were verified. No existing identity was edited. Customer Hosting workflow 34149572084 and admin Hosting workflow 34149572079 completed successfully.


Repair validation before PR: 420 Functions unit tests across 65 files and 34 emulator integration tests across 20 files passed. Functions webpack build, lint, frozen-lockfile validation, and the revised test quota/identity preflight passed. Emulator environment files were restored byte-for-byte and owned servers stopped. These results do not count as deployed acceptance.

At 18:44 UTC, manual test deployment 34152350919 completed at db40124 with
`skip_tests=true`. It verified all 40 production Functions, five Scheduler jobs,
one task queue, one Eventarc trigger, and Remote Config version 41. Customer
34152352962 and admin 34152355365 also passed. The retry required a scoped
service-account-user binding for the CI identity on the test App Engine default
service account.

Live QA findings and partial evidence:

- The isolated owner signed in and saw the expected owner navigation. The 2026
  schedule contains enabled December 12, 13, 15, and 16 slots.
- Both sites showed the update-ready prompt. Dismissing it left the pages usable;
  this does not yet prove the full update lifecycle.
- Owner settings failed: `/readPublicParametersSettings` returned HTTP 200 with
  `text/html`, because both settings callables lacked admin Hosting rewrites.
  The repair adds both routes and a local regression test (passed).
- Onboarding rejected malformed email, short ZIP, and mismatched passwords.
  The ZIP error exposed `FORM_ERRORS.PATTERN`; English and Spanish messages were
  added. Custom Other referral selection saved successfully for a valid answer.
- Public sign-up submission is pending action-time consent confirmation. API
  fixture setup, if used for subsequent journeys, is not sign-up UI evidence.

At 19:30 UTC, the latest deployed Functions repair is `6c0b8b2` (run
34153534488). The owner callables now use the initialized Admin SDK instance;
the previous mixed-module import failed with `app/no-app`. Its cold-start
regression test passed locally. Owner publish/read, stale ETag conflict rejection,
and retention of unsaved edits passed in the browser. The legacy Firestore
settings document remains untouched.

Both Chrome and the in-app browser later held an open real-time stream without
receiving new settings. A normal reload fetched current values. Commit
`cd1f51f` adds a visible 60-second client-fetch watchdog while retaining stream
updates, hidden-page pauses and failure backoff. Its 174 core tests passed
locally. This fallback does not establish the healthy-stream 10-second target.
Test deployment 34155576662 is in progress.

Temporary settings were restored as Remote Config version 48 and compared with
the saved version 41 settings: all fields match. Test registration, account
creation, check-in, pre-registration, cancellation and rescheduling are enabled;
maintenance, weather closure and the global alert are off. Spanish maintenance
and global-alert text displayed correctly; weather and account-creation switch
delivery still require a retest after the watchdog deployment.

Fixture scope: this run owns `qa-rc-20260907-owner`, `qa-rc-20260907-admin`,
`qa-rc-20260907-checkin` and `qa-rc-20260907-customer`, plus the labeled browser
pre-registration and on-site households. The CLI customer fixture did not store
legal acceptance and does not count as successful public onboarding. Camera
decoding, inbox delivery, credential changes and permission-grant UI steps remain
unverified. Current-year schedule generation was cancelled at its explicit
initialization confirmation; no schedule was created or deleted.

Further live findings at 19:40 UTC:

- The weather notice arrived without reload between the 16- and 42-second
  observations after version 49 publication. Clearing weather and disabling
  account creation updated the underlying home, but the old blocking notice
  stayed open. This is a separate UI dismissal defect, not evidence that every
  later settings update failed to arrive. The production bundle minifies the
  component name used by the dismissal check. A repair passed eight focused
  local app tests, including initial maintenance and rapid state changes.
- The same customer credentials signed in successfully on the fresh
  `santashop-app-test.web.app` origin. The custom-origin browser recorded
  repeated HTTP 504 failures for the external reCAPTCHA JavaScript asset before
  its long sign-in failures. The generic incorrect-credentials message does not
  establish that the credentials were wrong.
- Settings are restored as version 52. A fresh API snapshot compared equal to
  the original version 41 settings across all fields.
- QR stability repair: 10 focused Functions unit tests and one cancellation
  emulator integration test passed. Cancellation preserves the code and image;
  live re-registration validation awaits test deployment.
- Staff route repair: 15 focused admin tests passed. The attempted focused
  STAFF-006 emulator run was blocked by local function-discovery environment
  propagation before assertions; it is not counted as a test pass.
