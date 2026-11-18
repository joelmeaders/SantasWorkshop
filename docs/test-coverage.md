# Test coverage

The repository validates the customer app, admin app, shared core, models,
Functions, and emulator browser workflows. Test counts and coverage percentages
come from the report for the revision under test rather than a stored snapshot.

| Area | Command from the workspace root |
| --- | --- |
| Customer unit tests | `pnpm --filter @santashop/app test` |
| Admin unit tests | `pnpm --filter @santashop/admin test` |
| Shared core tests | `pnpm --filter @santashop/core test` |
| Models compilation | `pnpm --filter @santashop/models build` |
| Functions unit tests | `pnpm run functions:test:unit` |
| Functions integration | `pnpm run functions:test:integration` |
| Tooling and email template checks | `node --test scripts/*.test.mjs scripts/load/*.test.mjs` |
| Browser test typecheck | `pnpm --filter @santashop/e2e typecheck` |
| Customer browser tests | `pnpm run e2e:test:app` |
| Admin browser tests | `pnpm run e2e:test:admin` |

Angular tests use native Vitest and headless Chromium with coverage enabled in
`angular.json`; root `vitest.config.mjs` defines their thresholds. Functions
`vitest.config.ts` also defines thresholds, but ordinary Functions unit runs do
not collect coverage. Use `pnpm --filter @santashop/functions test:coverage` to
collect it and enforce those thresholds. Build shared models and core before
application validation. A focused run with coverage enabled can pass its tests
and still fail a global coverage threshold; report both outcomes accurately.

The normal Functions integration command includes the Registration Review,
nightly review, review actions, and denylist suites. Their fixtures use a separate
demo project within the shared local emulators, with cleanup between tests; no
extra opt-in test flags or dedicated ports are required.

The browser CI workflow typechecks the Playwright suite before downloading its
browser or starting emulators. The E2E TypeScript library includes ES2023 APIs
available in its Node 24 runtime. Its models type imports resolve directly to
shared source so the check also works before library builds on a fresh checkout.

Browser tests use the Firebase emulators and disposable seeded data. They cover
account access, registration, QR state, staff workflows, reports, refresh and
error recovery, owner operations, and concurrent requests. Customer and admin
servers share port 4100 and run sequentially on one machine. CI runs the two
targets on separate runners with separate emulator instances. Playwright runs
mobile Chromium and a bounded desktop Chromium smoke project.
Other browser engines require separate execution evidence.

External SES delivery, deployed rules, production load, backup restoration,
manual accessibility review, and operational monitoring require their own
checks. Passing local tests does not establish those outcomes. The
[integrated acceptance matrix](testing/integrated-test-suite.md) distinguishes
implemented scenarios from requirements without automated coverage.
