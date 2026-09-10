# E2E testing guide

## Runtime and configuration

Use Node.js 24.15+ and pnpm 10.14+. Run commands from the workspace root.
Install dependencies with `pnpm install`, then install Chromium with `pnpm run e2e:setup`.

The root `.env` must supply the complete `LOCAL_*` Functions inputs from
[.env.example](../../.env.example), including `LOCAL_SANTASHOP_PROGRAM_YEAR`.
The preparation scripts generate browser configuration. Do not hand-edit generated configuration files.

E2E uses project `demo-santashop` and [firebase.e2e.json](../../firebase.e2e.json):

| Service | Endpoint |
| --- | --- |
| Browser app | `http://localhost:4100` |
| Auth | `127.0.0.1:9099` |
| Firestore | `127.0.0.1:8180` |
| Functions | `127.0.0.1:5001` |
| Storage | `127.0.0.1:9199` |

The ordinary local workflow uses Firestore port 8080. Keep its configuration separate from E2E.
The remote test configuration targets `santas-workshop-test` and is not the demo emulator configuration.

Functions use the explicit `nodejs24` emulator/deployment runtime; workspace tooling also uses Node 24.

### Alternate emulator ports

For an isolated emulator run, set each `E2E_*_PORT` value to the matching port
in the separately provided Firebase configuration. The existing root E2E
commands use `firebase.e2e.json` and its default ports. Set
`FUNCTIONS_EMULATOR_URL` to the full Functions emulator base URL when the
readiness callable uses an alternate Functions port.
The fixture inputs are defined in [season.ts](../../santashop-e2e/fixtures/season.ts);
the readiness probe reads its URL in [wait-for-functions.mjs](../../santashop-e2e/scripts/wait-for-functions.mjs).

## Automated suites

Run both suites sequentially:

```text
pnpm run e2e:test
```

Or run one target:

```text
pnpm run e2e:test:app
pnpm run e2e:test:admin
```

Each command prepares its target, builds dependencies and Functions, starts the browser server,
and runs Playwright through `firebase emulators:exec`. A callable readiness probe verifies
that the Functions emulator loaded the test helpers. An open port alone is insufficient.
Both browser servers use port 4100. Run one target at a time.
Use these root commands for CI orchestration as well; they own emulator startup
and shutdown for each suite.

## Manual debugging and individual specs

Prepare the customer target and start emulators in terminal 1:

```text
pnpm run e2e:prepare:app
pnpm run e2e:emulators
```

Start the customer server in terminal 2:

```text
pnpm run e2e:serve:app
```

Wait for services and run a spec in terminal 3:

```text
pnpm exec wait-on http://localhost:4100 tcp:127.0.0.1:5001 tcp:127.0.0.1:8180 tcp:127.0.0.1:9099 tcp:127.0.0.1:9199
pnpm run e2e:functions:ready
pnpm --filter @santashop/e2e exec playwright test tests/public/account-access.spec.ts
```

For admin tests, use `e2e:prepare:admin` in terminal 1 and `e2e:serve:admin` in terminal 2.
Use an admin spec such as `tests/admin/access-and-controls.spec.ts` in terminal 3.
The E2E serve scripts retain the prepared configuration and use port 4100.

To run the whole prepared target in terminal 3, use `pnpm run e2e:run:app`
or `pnpm run e2e:run:admin`. These commands wait for services and run the
callable readiness probe before Playwright.

### Interactive debugging

After preparing the target, starting its server and emulators, and completing
the readiness steps above, choose a debugging mode:

```text
# Run tests with UI mode for debugging
pnpm --filter @santashop/e2e test:ui tests/public

# Run tests in headed mode (see browser)
pnpm --filter @santashop/e2e test:headed tests/public

# Debug tests step-by-step
pnpm --filter @santashop/e2e test:debug tests/public

# Generate test code against the local browser app
pnpm --filter @santashop/e2e test:codegen
```

The `tests/public` filter runs only customer specs against the prepared customer
app. Use `tests/admin` in all three test commands when the admin app is prepared.
Without a target filter, Playwright can run both suites against the same server.
These package commands do not start emulators or prepare the application.
The readiness probe clears emulator fixtures; run it before seeding, never
during a journey or against a deployed site.

### Reports and evidence

Open an existing local HTML report with:

```text
pnpm --filter @santashop/e2e test:report
```

Local runs generate HTML reports; CI uses the list reporter. Inspect
`santashop-e2e/playwright-report/` and `santashop-e2e/test-results/` after a failure.
Create dated test reports in the Obsidian project under the
[recording policy](../README.md#recording-future-work). Generated Playwright
artifacts remain in their configured ignored folders until selected evidence
is archived. Do not add narrative execution logs to repository guides.

## Fixtures and supported user flows

Import `test` and `expect` from [test-fixtures.ts](../../santashop-e2e/fixtures/test-fixtures.ts).
Place `.spec.ts` files under the matching feature directory in `santashop-e2e/tests/public/`
or `santashop-e2e/tests/admin/`. Use the custom emulator fixture instead of Playwright's base test.
Use `clearData()` and reseed each test's state. The helper deletes emulator Auth users and
configured Firestore collections and the `registrations/` and `emailTemplates/`
Storage prefixes. Use unique paths and explicit cleanup for other Storage fixtures.

Customer helpers live in [account-helpers.ts](../../santashop-e2e/fixtures/account-helpers.ts):

- `randomAccount()` generates values within the form limits, including a string ZIP code.
- `fillCreateAccountForm()` fills account fields.
- `selectReferralViaUi()` selects a referral in the signup form.
- `createAccountViaUi()` completes account fields, referral selection, legal consent, and email confirmation.
- `signInViaUi()` and `signOutViaUi()` exercise account access through the UI.

Signup requires a referral before account creation. The overview then shows the child controls and account menu.
Child, appointment, and submission helpers live in [registration-helpers.ts](../../santashop-e2e/fixtures/registration-helpers.ts).

```typescript
import { test, expect } from '../../fixtures/test-fixtures';
import {
  createAccountViaUi,
  randomAccount,
  signInViaUi,
  signOutViaUi,
} from '../../fixtures/account-helpers';

test.beforeEach(async ({ clearData, seedScenario }) => {
  await clearData();
  await seedScenario('create-account-enabled');
});

test('allows return access after sign-out', async ({ page }) => {
  const account = randomAccount();
  await createAccountViaUi(page, account);
  await expect(page.locator('#children-heading')).toBeVisible();
  await signOutViaUi(page);
  await signInViaUi(page, account);
  await expect(page.locator('#menuButton')).toBeVisible();
});
```

Staff helpers live in [admin-helpers.ts](../../santashop-e2e/fixtures/admin-helpers.ts).
Call `seedAdminUser(defaultAdminAccount())`, then `signInAdminViaUi()` with that same account.
The helper creates an email-verified Auth emulator user with `roles` and the distinct `owner` capability.
The staff shell accepts the `admin` or `checkin` role, or owner access. Admin tools and owner operations
apply their corresponding guards. Test denied access with the relevant roles absent.

Use `seedDateTimeSlots()` with explicit IDs for schedule row tests. Seed all public parameters,
accounts, children, and slots needed by the test. Do not depend on another test's records.

## Reliable browser assertions

- Wait for a URL and a visible element. Firebase listeners keep `networkidle` from settling.
- Reuse Ionic input helpers. Assert the native input value and blur when the UI listens to `ionChange`.
- For Ionic buttons, inspect the `button-disabled` class when native enabled assertions do not reflect host state.
- Use `ion-alert button.alert-button-role-confirm` for the signup email confirmation action.
- Use existing stable selectors and semantic locators. Inspect pointer interception before changing click behavior.
- Keep one worker, no retries, and isolated seeds because tests share the emulator instance.
- Keep event dates aligned with the configured program year and `America/Denver` business timezone.

[playwright.config.ts](../../santashop-e2e/playwright.config.ts) runs headless mobile Chromium with the Pixel 5 profile
plus the `desktop-chrome-smoke` project for `desktop-smoke.spec.ts`,
stops after one failure, and retains failure screenshots, video, and traces.
Firefox and WebKit projects remain disabled. See [reports and evidence](#reports-and-evidence)
for report commands and artifact locations.

## Emulator boundaries and validation

Test helper callables are emulator-only. Public callables use emulator-aware App Check enforcement.
Browser tests must sign in through the actual UI. Direct REST token access is appropriate for explicit rules tests.

SES dispatch is disabled in emulators by default. Ordinary E2E tests verify queue state and UI behavior.
An intentional SES integration run needs safe credentials and `SANTASHOP_SEND_EMAILS_FROM_EMULATOR=true`.
Queue acceptance does not prove recipient delivery.

Run the affected spec first. Broaden to its application suite when the change affects shared flows.
Changes to backend helpers also need Functions unit and integration checks. Review generated configuration
diffs after validation and restore local configuration as needed. Keep evidence of unit, emulator, browser,
and deployed behavior separate.
