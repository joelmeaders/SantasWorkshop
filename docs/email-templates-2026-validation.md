# Validation: 2026 bilingual emails

Validated locally on September 6, 2026, in the fresh worktree based on `e31ba4b`.

| Check                                              | Result                                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Backend unit suite                                 | 300 tests passed, 58 files                                                                                                   |
| Customer unit suite                                | 149 tests passed, 35 files; coverage thresholds passed                                                                       |
| Admin unit suite                                   | 298 tests passed, 53 files; coverage thresholds passed                                                                       |
| Backend emulator integration checks                | 32 tests passed across 21 files, with isolated-port configuration described below                                            |
| Customer browser suite                             | 44 tests passed, mobile Chromium                                                                                             |
| Admin browser suite                                | 74 tests passed, mobile Chromium                                                                                             |
| Models and core library builds                     | Passed                                                                                                                       |
| Customer and admin production-configuration builds | Passed with local E2E configuration; not production deployment configuration or deployed QA                                  |
| Functions standard webpack build                   | Passed                                                                                                                       |
| App, Functions, and models lint                    | Passed                                                                                                                       |
| Admin lint                                         | No errors; one existing warning in unrelated `stats/check-in/check-in.page.ts:259`                                           |
| Template render checks                             | All six templates at 360px and 800px passed overflow and images-blocked text checks; all desktop and phone renders inspected |
| Linked web destinations                            | Registration, map, both FAQs, website, and Facebook returned HTTP 200                                                        |
| Git whitespace check                               | Passed                                                                                                                       |

The customer and admin browser suites ran serially against local emulators with queued outbound emails suppressed. They covered real emulator Auth, Firestore, Functions, and Storage paths. The added customer test verifies signup language, a fresh browser login, a saved language change, and restoration in the earlier browser. The added admin test imports Spanish JSON, saves and reloads it, exports JSON and HTML, and verifies that invalid JSON leaves the editor unchanged. Existing template edit/delete coverage also passed.

Focused unit coverage includes six delivery-type/language combinations, English fallback, old profiles and queued appointment text, Spanish cancellation fallback, missing templates, published-revision isolation, latest-publication selection with Firestore timestamps, Denver daylight saving time, authenticated language updates, signup/preregistration language defaults, all six starter package round trips, invalid files, HTML import confirmation, seasonal approval invalidation, unsaved publication prevention, and unique key/SES-name checks. SES command selection and rendered data were inspected through provider mocks. Provider acceptance is not proof of recipient delivery.

## Isolated emulator setup

The default ports were occupied by other work, so validation used Functions `15001`, Firestore `18180`, Auth `19099`, Storage `19199`, and the browser server `14100`. These were temporary worktree-only overrides. The original generator and test fixture files were restored after testing. The owned emulator and browser-server processes were stopped.

The first integration run passed 26 tests in 19 files using the `santas-workshop-test` namespace. Six rules tests had hardcoded endpoints and Auth project assumptions. After aligning their temporary endpoints and namespace with the isolated `demo-santashop` emulator, those six tests passed separately. No live project data was used. Integration tests invoke raw handlers with real emulator side effects; browser tests supply the separate evidence for callable wrappers and signed-in flows.

## Limits and resolved failures

Early browser runs caught a missing customer Firestore provider, a CSS-brace placeholder-validation conflict in the generated starters, and omitted export fields. All were corrected and the complete browser suites subsequently passed. Unit tests now validate the actual six starter packages.

The standard Functions build passes. A supplemental standalone `tsc` check does not pass: the repository Functions TypeScript configuration includes test/build-reference issues, and a source-only check reports existing diagnostics such as potentially undefined Auth results, callable generic inference, and index-signature accesses. A baseline source snapshot also failed. This work does not claim a clean standalone Functions type check.

No deployment, live SES publication, real recipient test send, Gmail/Outlook/Apple Mail rendering test, or delivered-email confirmation was performed. The historical venue and 2026 opening remain unconfirmed draft content. Publishing the starters requires review and replacement of the draft notes.

Detailed execution logs remain in the worktree as ignored `email-*.log` files. Reproducible preview results and screenshots are under `.artifacts/email-templates-2026/`.

## Logo refresh and rebase follow-up

The feature branch was rebased without conflicts onto freshly fetched `origin/master` at `d5a2bbd`. The original 2025 logo is now linked in all six headers from `https://storage.googleapis.com/santas-workshop-193b5.appspot.com/public/dscs_logo_email.png`. Spanish emails have Spanish alt text. The renderer now fails if the logo does not load.

After the rebase, all 310 Functions, 154 customer, and 301 admin unit tests passed (765 total). Models/core library builds, the Functions webpack build, and customer/admin production-configuration builds passed. All six previews passed at both widths, including the logo load and images-blocked text checks. Desktop and phone logo layouts were inspected. The integration and browser suite results above are from before this rebase; those suites were not rerun for this logo update.

## Mission and QR size follow-up

All six HTML and plain-text templates now include the mission, “A Toy for Every Girl & Boy,” translated as “Un juguete para cada niña y niño” in Spanish. The HTML places it directly below the logo.

Confirmation and reminder QR images now use 432 × 432 pixels, twice the previous 216 × 216 dimensions. They scale down proportionally on small screens. Rendered measurements were 432 × 432 at an 800px viewport and 296 × 296 at a 360px viewport. All six desktop/mobile render and images-blocked checks passed. Cancellation templates still contain no QR ticket. Full application suites were not rerun for this content and sizing change.
