# E2E testing guide for agents

## Purpose

Use this guide when creating or updating Playwright tests in `santashop-e2e/` for the public SantaShop app.

This repo has three Firebase config modes that matter for end-to-end testing:

- `test` mode targets the `santas-workshop-test` project and generates `production: true`
- `local` mode targets the `demo-santashop` emulator project and generates `production: false`
- `e2e` mode also targets `demo-santashop`, generates `production: false`, and
  uses the dedicated Firestore emulator port `8180`

For **emulator-backed public-app e2e tests**, use the **e2e/demo emulator
flow**. The separate port avoids collisions with common local services on
`8080`.

## The validated stack

The current passing setup is:

- Firebase emulators running under project `demo-santashop`
- `firebase.e2e.json` explicitly selecting the same `nodejs24` Functions
  runtime as the deployment configuration
- Browser app served from `santashop-app` with the **e2e** config
- Playwright running in **headless**, **CI-style**, **single-worker**, **no-retry** mode
- A callable readiness probe confirming `testClearAllData` loaded before
  Playwright starts
- Firebase `emulators:exec` owning the emulator lifecycle, so each suite starts
  only after its emulators are ready and tears them down on success, failure,
  or timeout
- Playwright fixtures calling emulator-only helper functions at:
    - `http://127.0.0.1:5001/demo-santashop/us-central1`

Relevant files:

- `santashop-e2e/playwright.config.ts`
- `santashop-e2e/fixtures/test-fixtures.ts`
- `santashop-e2e/fixtures/account-helpers.ts`
- `santashop-functions/src/index.ts`
- `santashop-app/src/main.ts`

## Important rule: use the emulator

All public-app e2e tests should run against emulators.

For this repo, that means:

- use `config:app:e2e`
- use `config:functions:local`
- start Firebase emulators with `--config firebase.e2e.json --project demo-santashop`
- let the browser connect to `127.0.0.1` emulator endpoints

Use the root `e2e:test:app` and `e2e:test:admin` scripts for the validated
local/demo orchestration. The older `start:test` package scripts target the
remote test configuration and are not the emulator-backed e2e path.

## Validated authoring workflow

### One-time setup

```text
volta run --node 24.11.0 pnpm install
volta run --node 24.11.0 pnpm --filter @santashop/e2e exec playwright install
```

### Prepare local emulator config and builds

```text
volta run --node 24.11.0 pnpm run config:app:e2e
volta run --node 24.11.0 pnpm run config:functions:local
volta run --node 24.11.0 pnpm --filter @santashop/models build
volta run --node 24.11.0 pnpm --filter @santashop/core build:prod
volta run --node 24.11.0 pnpm e2e:prebuild
```

### Recommended automated run

```text
volta run --node 24.11.0 pnpm e2e:test:app
```

This prepares local app and Functions configuration, builds shared packages and
Functions, starts the public app, and uses `firebase emulators:exec` to run
`tests/public` against a fresh emulator session. The runner waits for an actual
emulator-only callable, not just port `5001`, so a Functions source-loading
error fails during startup instead of once per browser scenario.

### Start services in separate terminals

Terminal 1:

```text
volta run --node 24.11.0 pnpm exec firebase emulators:start --config firebase.e2e.json --project demo-santashop --only auth,firestore,functions,storage
```

Terminal 2:

```text
volta run --node 24.11.0 pnpm exec ng serve santashop-app --configuration=development --port 4100
```

### Run tests headlessly

```text
$env:CI='1'
volta run --node 24.11.0 pnpm exec wait-on http://localhost:4100
volta run --node 24.11.0 pnpm run e2e:functions:ready
volta run --node 24.11.0 pnpm --filter @santashop/e2e test tests/public
$env:CI=$null
```

Notes:

- The Playwright config is already headless by default.
- The Firestore email trigger retains queued email records but does not contact
  SES from the Functions emulator by default. Set
  `SANTASHOP_SEND_EMAILS_FROM_EMULATOR=true` only for an intentional SES
  integration run with safe credentials.
- The only Playwright project is `mobile-chrome`, using the Pixel 5 device
  profile.
- `CI=1` keeps reporting non-interactive.
- Retries are disabled (`retries: 0`) for faster feedback.
- `maxFailures` is `1`: the suite stops after the first failed or timed-out
  test, which preserves the first actionable failure and avoids corrupting
  shared emulator state.
- Workers are fixed at `1` because tests mutate shared emulator state.

## How to structure tests

Use the custom Playwright test wrapper from `fixtures/test-fixtures.ts`:

```ts
import { test, expect } from '../../fixtures/test-fixtures';
```

This gives you:

- `clearData()`
- `seedScenario(name)`
- `seedPublicParams(params)`

### Standard per-test setup

Most public-app specs should start with:

```ts
test.beforeEach(async ({ clearData, seedScenario }) => {
	await clearData();
	await seedScenario('create-account-enabled');
});
```

This keeps tests isolated and repeatable.

## Reuse the account helpers

Before writing new account-oriented flows, check `santashop-e2e/fixtures/account-helpers.ts`.

Available helpers:

- `randomAccount()`
- `fillCreateAccountForm(page, account)`
- `createAccountViaUi(page, account)`
- `completeReferralViaUi(page)`
- `signInViaUi(page, account)`
- `signOutViaUi(page)`

### What each helper is for

- `randomAccount()` creates a short, valid, unique account payload that fits the form validators.
- `createAccountViaUi()` drives the real UI flow for account creation and confirms the email alert.
- `completeReferralViaUi()` finishes the required referral selection shown to fresh accounts.
- `signInViaUi()` signs in an existing account.
- `signOutViaUi()` uses the internal header menu once it is available.

## Public-app flow gotchas

These are the main pitfalls already encountered and solved.

### 1. Create-account assertions must use the UI

If the test is validating account creation, do not shortcut by seeding auth or calling backend account creation directly.

Use `createAccountViaUi()`.

### 2. Fresh accounts land on a referral takeover first

After creating an account, the user lands on `/pre-registration/overview`, but the page initially renders only `app-referral-card`.

Until a referral is saved:

- the internal header is not rendered
- `#menuButton` does not exist
- sign-out is not available

If a test needs the post-login header/menu, call:

```ts
await completeReferralViaUi(page);
```

before trying to sign out or verify menu-driven UI.

### 3. Do not wait for `networkidle`

Firebase realtime listeners keep the network active, so `waitUntil: 'networkidle'` can hang even when the app is already on the correct route.

Prefer:

- `await page.waitForURL('**/pre-registration/overview')`
- followed by a visible-element assertion

### 4. Ionic buttons do not behave like plain HTML buttons

For `ion-button`, `toBeEnabled()` / `toBeDisabled()` can be unreliable.

Use the Ionic disabled class instead:

```ts
await expect(page.locator('#submitButton')).toHaveClass(/button-disabled/);
await expect(page.locator('#submitButton')).not.toHaveClass(/button-disabled/);
```

### 5. Ionic alert button roles are class-based

For the sign-up confirm-email alert, target the confirm button with:

```ts
page.locator('ion-alert button.alert-button-role-confirm');
```

Do not rely on a `role="cancel"` attribute filter.

### 6. Ionic inputs can lag behind plain `fill()`

`ion-input` proxies to an inner native input, and Angular form state can lag if you just call `fill()` and move on.

The helper `fillField()` in `account-helpers.ts` solves this by filling and then asserting the value registered.

If you write new input helpers, follow the same pattern.

### 7. Generated test data must satisfy form validators

The sign-up form currently enforces:

- `emailAddress`: max length 40
- `lastName`: max length 25
- `password`: min length 8
- `zipCode`: exactly 5 digits

Do not generate long timestamp-heavy emails or long last names. Reuse `randomAccount()`.

## Emulator helper function rules

The emulator helpers live in `santashop-functions/src/index.ts` and `santashop-e2e/fixtures/test-fixtures.ts`.

Current helper callables:

- `testClearAllData`
- `testSeedScenario`
- `testSeedPublicParameters`
- `testSeedAdminUser`
- `testSeedDateTimeSlots`
- `testSeedRegistrationSearchIndex`
- `testSeedScheduleStats`

Rules:

- They must remain emulator-only.
- They should never be required for production behavior.
- They are appropriate for test setup and global app-state seeding.

If future tests need more backend setup, add new **emulator-only** helper callables following the same pattern.

## Admin-app e2e workflow

Admin Playwright tests should also run against the **e2e/demo emulator flow**.

For admin tests, use:

- `config:admin:e2e`
- `config:functions:local`
- the same `demo-santashop` Firebase emulator project
- the admin app served on port `4100`

### Prepare local emulator config and builds for admin tests

```text
volta run --node 24.11.0 pnpm run config:admin:e2e
volta run --node 24.11.0 pnpm run config:functions:local
volta run --node 24.11.0 pnpm --filter @santashop/models build
volta run --node 24.11.0 pnpm --filter @santashop/core build:prod
volta run --node 24.11.0 pnpm e2e:prebuild
```

### Start services in separate terminals for admin tests

Terminal 1:

```text
volta run --node 24.11.0 pnpm exec firebase emulators:start --config firebase.e2e.json --project demo-santashop --only auth,firestore,functions,storage
```

Terminal 2:

```text
volta run --node 24.11.0 pnpm --filter @santashop/admin start:local
```

### Run admin tests headlessly

```text
$env:CI='1'
volta run --node 24.11.0 pnpm exec wait-on http://localhost:4100
volta run --node 24.11.0 pnpm --filter @santashop/e2e test tests/admin/schedule-editor/generate-schedules.spec.ts
$env:CI=$null
```

Notes:

- Do not run the public app and admin app on port `4100` at the same time.
- Admin sign-in requires an emulator auth user with the `admin` custom claim.
- Reuse the new Playwright fixtures `seedAdminUser()` and `seedDateTimeSlots()` for isolated admin specs.

## Admin-app helpers

Admin helpers live in `santashop-e2e/fixtures/admin-helpers.ts`.

Available helpers:

- `defaultAdminAccount()`
- `fillAdminSignInForm(page, account)`
- `signInAdminViaUi(page, account)`
- `navigateToScheduleEditorViaLanding(page)`
- `fillIonicInput(page, selector, value)`
- `clickIonCheckbox(page, selector)`
- `clickIonToggle(page, selector)`
- `confirmAlertButton(page, buttonText)`
- `scheduleSlot(overrides)`

### What each admin helper is for

- `defaultAdminAccount()` returns a valid emulator-only admin credential payload.
- `signInAdminViaUi()` drives the real admin login form and waits for `/admin/landing`.
- `navigateToScheduleEditorViaLanding()` verifies the admin-only menu entry and opens the feature via the landing page.
- `scheduleSlot()` builds stable seeded `dateTimeSlots` input with deterministic IDs for schedule-editor tests.

## Admin-app gotchas

### 1. Admin login needs a custom claim, not just a seeded auth user

The admin route guard checks `token.claims.admin`, so a plain emulator auth user is not enough.

Use:

```ts
await seedAdminUser(defaultAdminAccount());
```

before trying to log into the admin UI.

### 2. Prefer seeded `dateTimeSlots` with explicit IDs for row-level editor tests

The schedule editor renders per-row controls using the Firestore document ID. If a test needs to target a specific row or action button, seed slots with explicit IDs so selectors stay stable.

### 3. Blur `ion-input` fields after `fill()` when the page reacts on `ionChange`

The schedule editor updates on `ionChange`, which fires more reliably after blur than after a raw `fill()` alone.

The helper `fillIonicInput()` fills, asserts the value, and blurs the inner input so row updates actually fire.

### 4. Keep admin specs self-contained

Admin schedule-editor specs should call `clearData()` and then reseed everything they need:

- public parameters
- admin auth user with claim
- any `dateTimeSlots`

Do not rely on another spec having already created schedules or users.

### 5. Admin emulator endpoints should use `127.0.0.1`, not `localhost`

While building the admin schedule-editor tests, the admin app showed Firestore writes only as optimistic local state when the bootstrap used `localhost` for emulator connections. The rows appeared immediately after a client-side add, but disappeared on reload and externally seeded `dateTimeSlots` never rendered.

Aligning the admin app emulator connections with the public app's validated pattern fixed this:

- Auth emulator: `http://127.0.0.1:9099`
- Functions emulator: `127.0.0.1:5001`
- Firestore emulator: `127.0.0.1:8180` in e2e mode (`8080` remains the
  ordinary local-development default)

If admin e2e tests can sign in but seeded Firestore documents never appear, check these host values first.

### 6. The fixed admin tab bar can intercept clicks on lower row actions

On the schedule-editor page, lower-row action buttons such as delete can overlap with the fixed footer tab bar in headless browser runs.

If a click times out with pointer interception from `ion-tab-bar` or `ion-content`, or the action button is visibly clipped at the right edge:

- call `scrollIntoViewIfNeeded()` on the button locator
- if needed, trigger the Ionic button host directly with `locator.evaluate(el => el.click())`

Use that sparingly and only when footer overlap / clipped layout is the actual cause.

## App Check rule for emulator e2e

The public app calls real callable functions such as `newAccount` and `updateReferredBy`.

Those functions now use emulator-aware App Check enforcement:

- enforced outside the emulator
- relaxed when `FUNCTIONS_EMULATOR === 'true'`

This is required so emulator-backed e2e tests can exercise the real callable flow.

If you add a new public callable that the browser must hit during e2e, follow the same rule or your local tests may fail with `functions/unauthenticated`.

## Patterns for common tests

### Create account test

```ts
const account = randomAccount();
await createAccountViaUi(page, account);
await expect(page.locator('app-referral-card')).toBeVisible();
```

### Sign out test

```ts
const account = randomAccount();
await createAccountViaUi(page, account);
await completeReferralViaUi(page);
await signOutViaUi(page);
await expect(page.locator('#signInButton')).toBeVisible();
```

### Sign in test

```ts
const account = randomAccount();
await createAccountViaUi(page, account);
await completeReferralViaUi(page);
await signOutViaUi(page);
await signInViaUi(page, account);
await expect(page.locator('#menuButton')).toBeVisible();
```

### Global alert test

```ts
await seedPublicParams({
	registrationEnabled: true,
	maintenanceModeEnabled: false,
	weatherModeEnabled: false,
	createAccountEnabled: true,
	globalAlert: {
		displayAlert: true,
		titleEn: 'Important notice',
		titleEs: 'Aviso importante',
		messageEn: 'This is a global alert test message.',
		messageEs: 'Este es un mensaje de prueba de alerta global.',
	},
});

await page.goto('/');
await expect(page.locator('ion-alert')).toBeVisible();
```

## When to add selectors to app source

If a UI element is hard to target reliably, prefer adding a small stable selector in the app source rather than using brittle structural selectors.

Current examples already added for e2e:

- `#signInEmail`
- `#signInPassword`
- `#signInButton`
- `#menuButton`
- `#signOutButton`

Keep these additions minimal and focused on test stability.

## What to validate after changes

For small e2e changes, prefer a feature-scoped spec run over the complete
public/admin suite.

Recommended validation order:

1. run only the affected Playwright spec(s) on `mobile-chrome`
2. fix flakes and selector issues
3. run the full targeted public-app auth/global-alert slice

Validated passing command from this workflow:

```text
$env:CI='1'
volta run --node 24.11.0 pnpm --filter @santashop/e2e test tests/public/account-access.spec.ts tests/public/entry-and-controls.spec.ts
$env:CI=$null
```

## Current passing target set

The public baseline is organized by feature and runs in headless mobile
Chromium:

- `tests/public/account-access.spec.ts`
- `tests/public/entry-and-controls.spec.ts`
- `tests/public/registration-lifecycle.spec.ts`

If a future change breaks them, start by checking:

- emulator project alignment (`demo-santashop`)
- app config mode (`local`, not `test`)
- App Check enforcement on public callables
- referral gating before menu access
- `networkidle` waits
- Ionic button/input quirks
