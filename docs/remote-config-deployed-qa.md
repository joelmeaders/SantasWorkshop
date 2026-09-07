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
| Entry controls | English/Spanish, registration, account creation, maintenance, weather and global alert | Not run |
| Authentication | Invalid login, protected routes, sign-in/out, reload, password reset request | Not run |
| Onboarding | Field validation, referral, consent controls, persisted customer | Not run |
| Account | Name/ZIP edit, validation, persistence | Not run |
| Children | Add/edit/remove disposable children, ages, preferences, cancel modal | Not run |
| Registration | Date selection, review, submit, ticket, reschedule, cancel/re-register, QR identity | Not run |
| Staff authorization | Customer, check-in, ordinary admin, owner routes and controls | Not run |
| Staff search | Email, name/ZIP, code, no matches, detail | Not run |
| Check-in | Invalid/cancelled code, review, coupons, success, duplicate protection | Not run |
| Staff registration | Pre-registration and on-site registration with disposable data | Not run |
| Email | Single QA recipient resend and queue state | Not run |
| Schedules | Read, year/filter, isolated fixture create/edit/delete | Not run |
| Templates | Isolated draft create/edit/preview/revision and safeguards | Not run |
| Staff management | Disposable identity lifecycle and claims refresh | Not run |
| Owner settings | Read, publish, conflict, real-time delivery, backend convergence, restore | Not run |
| Owner operations | Preview and safeguards; do not reset shared test data | Not run |
| Statistics | Reports, year/filter, refresh and scan-risk details | Not run |
| Presentation | Desktop/mobile, keyboard/modal behavior, Spanish | Not run |
| Update recovery | Visible version, reload, cache boundaries and download failure behavior | Not run |

## Release status

Production is not deployed by this run. The quota repair uses a private singleton
gateway with no persistent settings copy and unchanged consumer capacity. It is
under implementation and requires PR checks plus deployed validation. No skipped
or blocked journey counts as passed.

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
