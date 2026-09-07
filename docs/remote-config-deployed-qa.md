# Remote Config deployed release QA

Completed September 7, 2026. The customer app, admin app, Functions and rules
were promoted to production from validated code commit
`d19274f7909c004c69e8ab341f0f1650a080c2a4`. The release is tracked in
[PR #161](https://github.com/joelmeaders/SantasWorkshop/pull/161).
Deployment and PR merge are separate events.

## Deployment evidence

| Component           | Production workflow                                                                   | Result |
| ------------------- | ------------------------------------------------------------------------------------- | ------ |
| Functions and rules | [34159707238](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34159707238) | Passed |
| Customer app        | [34160079129](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34160079129) | Passed |
| Admin app           | [34160081431](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34160081431) | Passed |

All manual deployments used `skip_tests=true`, as requested. The five PR gates
passed before promotion. Build, configuration, Hosting and deployment checks
still ran. Later commits update evidence only; the deployed code SHA above is
unchanged.

Production verification:

- Live inventory matches all 40 source Functions. Five Scheduler jobs, one task
  queue and one Eventarc trigger passed the managed-resource checks.
- The deployed gateway and all six consumers pass the Remote Config readiness
  check. Quota is 60 template reads per minute; the required budget is 60. An
  anonymous request to the private gateway returned HTTP 403.
- Remote Config remains version 52 with registration disabled and maintenance
  enabled. The legacy Firestore settings document still has update time
  `2026-01-01T23:34:17.538668Z`.
- The production customer page renders its maintenance notice. Its Remote Config
  fetch returned HTTP 200 for `santas-workshop-193b5`.
- The production admin page renders the sign-in form and
  `@santashop/admin_PROD 2026.09.0-beta.3`. Both pages were visually inspected;
  their initial browser warning/error logs were empty.
- Production checks were read-only. No production QA accounts were created and
  no preexisting customer records were changed or deleted.

See [production setup](remote-config-production-setup.md) for IAM and ETag-protected
publication evidence. These results establish deployment and a read-only smoke
check, not authenticated production journeys or load acceptance.

## Test environment and automated validation

Test project: `santas-workshop-test`. Customer routes were exercised on
`test.denversantaclausshop.org` and `santashop-app-test.web.app`; admin routes on
`santas-workshop-test.web.app` and its `firebaseapp.com` alias. Browsers were
Chrome and the Codex in-app browser. The existing Chrome customer record was
not treated as disposable and was not changed.

The five PR gates passed on the deployed code SHA:

| Validation                           | Result                               |
| ------------------------------------ | ------------------------------------ |
| Customer emulator browser suite      | 50 passed                            |
| Admin emulator browser suite         | 83 passed                            |
| Functions unit tests                 | 425 passed                           |
| Functions emulator integration tests | 34 passed                            |
| Shared core tests                    | 174 passed                           |
| Customer unit tests                  | 164 passed                           |
| Admin unit tests                     | 320 passed                           |
| Storybook interaction tests          | 91 passed in each app validation job |
| Storybook visual gate                | Passed                               |

The Functions integration gate also ran both browser suites. These are emulator
and CI results, separate from the live checks below. Relevant focused local tests
ran before code was submitted. An earlier local STAFF-006 attempt failed during
emulator setup before assertions; it is not counted as passed. The later complete
admin CI suite passed.

## Live journey evidence

| Area                             | Observed result                                                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication                   | Invalid credentials rejected; correct sign-in, sign-out and session retention after reload passed. Protected routes redirected as expected.                                                                                           |
| Public onboarding                | Invalid ZIP/email and password mismatch rejected; referral controls exercised. Final submission was not completed because legal acceptance awaited the user's confirmation.                                                           |
| Customer account                 | Name and ZIP edits persisted after reload. Invalid ZIP showed the translated error and disabled Save.                                                                                                                                 |
| Children                         | Added, edited and removed only labeled QA children. Ages 0–2 omitted toy choice. One valid child enabled appointment selection.                                                                                                       |
| Registration                     | Selected an appointment, reviewed child/email/date details, submitted and loaded the ticket. Rescheduling retained the QR URL.                                                                                                        |
| Cancellation and re-registration | Cancellation returned to the overview without reload and retained the child. Re-registration loaded the exact same QR URL, including download token, as a 600-pixel image.                                                            |
| Staff authorization              | Check-in-only staff saw Home, Check-In and Search. Direct on-site and pre-registration URLs returned to the staff home. Ordinary admin had no owner settings links and could not open the owner editor.                               |
| Staff search                     | Email and name/ZIP found the isolated household; the current code opened the correct review details.                                                                                                                                  |
| Check-in                         | A labeled pre-registered household checked in with one coupon. An immediate repeat was blocked. Invalid codes were rejected. After cancellation, the same stable customer code showed “Canceled registration code” and blocked entry. |
| Staff registration               | Owner pre-registration and on-site registration completed for labeled QA households. The forbidden check-in-only registration form was fixed and its route guards passed live retesting.                                              |
| Schedules                        | Read and year filters passed. Past-year generation was rejected. Current-year initialization was cancelled at its explicit confirmation; no schedule was created or deleted.                                                          |
| Templates                        | Created an isolated QA template, published revision 1 and confirmed it loaded over revision 2 draft. Preview and cancel-delete passed. Test-send was acknowledged; inbox delivery was not verified.                                   |
| Staff management                 | List/refresh and a QA staff display-name edit passed. Roles were established as authorized test fixtures, not counted as successful permission-grant UI actions.                                                                      |
| Owner settings                   | Read, publish, reload and stale-version conflict rejection passed. A rejected draft retained its edits. Maintenance, weather and registration-closure notices changed and dismissed without reloading the customer page.              |
| Other controls                   | Turning check-in off disabled both its link and tab. Turning account creation off retained Sign In and removed the new-account action.                                                                                                |
| Owner operations                 | Preview passed. No annual reset was executed.                                                                                                                                                                                         |
| Reports                          | Registration, check-in and user reports loaded. The scan-risk timeline showed the correct isolated cancelled registration.                                                                                                            |
| Language and layout              | Spanish ticket, event details, account menu and help modal were inspected. A 390-by-844 mobile overview had no horizontal overflow.                                                                                                   |
| Update recovery                  | Normal update prompts reloaded both apps and retained sessions. An initial staff retry during worker transition failed; a later ordinary reload/retry recovered with the same credentials.                                            |

The run owns the `qa-rc-20260907-*` fixtures and the explicitly labeled browser
pre-registration/on-site households. The CLI customer fixture did not store legal
acceptance and is not evidence of public onboarding. The final customer fixture
is cancelled after the blocked-code retest. No shared test cleanup was run.

## Repairs verified

- Replaced unsupported direct template polling with a private singleton gateway,
  while retaining consumer capacity and validated settings/default continuity.
- Added owner callable Hosting routes and fixed the initialized Admin SDK client.
- Serialized notice transitions and preserved initial cached closure state in
  minified builds.
- Preserved QR code/image identity across cancellation and fixed navigation that
  had raced the refreshed registration state.
- Restricted staff registration routes and links to the intended admin role.
- Added missing ZIP validation translations.
- Allowed the two external script origins in worker fetch CSP and versioned the
  worker URL so installed workers can obtain the updated policy.
- Added the exact alternate test admin hostname to the reCAPTCHA allowlist,
  retaining `allowAllDomains: false` and all prior domains. Chrome then loaded
  the protected owner settings page at version 61 on that hostname. The IAB
  session received an attestation failure and the SDK's 24-hour throttle; no
  security protection was disabled to bypass it.

## Remaining limits

**The ten-second live settings delivery target is not met.** In Chrome, a stream
started at 20:28:39.737 UTC, version 59 was published at 20:28:56.171, and the first
43-byte stream chunk arrived at 20:29:36.236. The follow-up settings fetch completed
about 3.2 seconds later. HTTP 200 at stream establishment alone is not an
invalidation event.

A separate diagnostic bypassing worker handling also missed ten seconds; normal
worker handling was restored afterward. SDK source confirms real-time fetches
bypass the minimum interval. Ordinary fallback fetches can take roughly 120
seconds because the first 60-second attempt may still use the SDK cache. Firebase
provides no numeric ten-second SLA in its [real-time documentation](https://firebase.google.com/docs/remote-config/web/real-time).
The live checks prove eventual delivery and notice recovery, not that target.

Other limits:

- Physical camera decoding, actual inbox delivery, password changes, password
  reset completion and permission-grant UI actions were not verified.
- The initial public signup check awaited terms approval. After the user supplied
  standing approval on September 7, Chrome signup completed for the labeled
  `QA September Signup Chrome` account, using the approved mailbox alias ending
  `qa0907w`. Terms were accepted, newsletter opt-in remained off, and the email
  confirmation dialog was confirmed. The customer overview loaded with the
  expected empty-child prerequisite. Sign-out and a fresh sign-in returned to
  the same named account and overview. This closes the public signup gap.
- The separate in-app browser signup attempt (alias ending `qa0907v`) returned
  `functions/unauthenticated`. Its account-creation outcome was not independently
  verified. Neither attempt was cleaned up; no production records were involved.
- Current-year schedule initialization was deliberately cancelled at confirmation.
- Six test gateway samples returned HTTP 200 in 165–214 ms. This is smoke evidence,
  not a burst, replacement, quota-churn or load test.
- Production verification did not sign in or change customer data.
- Local `.env` contains a stale production Firebase key. The deployed production
  bundle uses the correctly restricted Browser key; CI consumes its GitHub
  secret. Local environment drift was not treated as proof of a CI defect.

All temporary test settings were restored as Remote Config version **61**. A fresh
API snapshot compared equal to the original version 41 settings across all fields.
