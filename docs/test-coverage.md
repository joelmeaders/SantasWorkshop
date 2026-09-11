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
| Customer browser tests | `pnpm run e2e:test:app` |
| Admin browser tests | `pnpm run e2e:test:admin` |

Angular tests use native Vitest and headless Chromium. Root `vitest.config.mjs`
and Functions `vitest.config.ts` define coverage thresholds. Build shared models
and core before application validation. A focused test run can pass its tests
and still fail a global coverage threshold; report both outcomes accurately.

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
