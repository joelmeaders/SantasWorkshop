---
name: santashop-e2e-testing
description: Run and author Santa's Workshop Playwright E2E tests against the Firebase Auth, Firestore, Functions, and Storage emulators, including deterministic data seeding, emulator-backed auth and claims, Ionic locators, debugging, and failure diagnosis. Use when adding or changing tests under santashop-e2e, running the public or admin suites, wiring emulator-only test helper callables, or troubleshooting emulator startup, readiness, auth, data isolation, or E2E configuration.
---

# Santa's Workshop E2E testing

Use this skill for integrated browser tests. Treat `santashop-e2e/` as the source of truth for Playwright configuration, fixtures, helpers, and specs; treat the root `package.json` as the source of truth for orchestration.

## Language boundary

Use TypeScript/JavaScript and Node.js tooling only for repository changes and helper scripts. Do not introduce a second language runtime or package manager.

## Choose the right test layer

- Use Playwright E2E tests for a real user journey through the Ionic app, Firebase Auth, Firestore, callable Functions, and Storage emulators.
- Use Angular unit tests when testing a component, page, service, guard, or observable in isolation. Mock `AuthService` with `useValue`, `of(...)`/`BehaviorSubject`, and Jasmine spies as nearby specs do; do not call emulator helper functions from a unit test.
- Use Functions unit tests for handler logic and controlled Auth/Admin SDK doubles. Use Functions integration tests when the behavior must prove real Auth/Firestore/Storage emulator side effects.

Do not mock `AuthService`, replace Firebase tokens, seed local storage, or intercept the Auth REST calls in a browser E2E test merely to skip sign-in. For E2E, seed the Auth emulator and sign in through the actual UI. Keep request-level rule checks explicit and limited to tests that are intentionally testing rules.

## Run the E2E suites

### Prerequisites

Use Node.js 24.11+ and pnpm 10.14+. From the repository root:

```text
pnpm install
pnpm run e2e:setup
```

Ensure the root `.env` supplies `SANTASHOP_PROGRAM_YEAR` (copy `.env.example` first when needed). The E2E preparation scripts generate the app/admin Firebase modules from `config.firebase.cjs`; do not hand-edit generated `src/config.ts` or `src/firebase.config.ts` files.

### Preferred commands

Run the complete customer and staff suites sequentially:

```text
pnpm run e2e:test
```

Run one application at a time:

```text
pnpm run e2e:test:app
pnpm run e2e:test:admin
```

Run headed, UI, or debug mode only after the app and emulators are already available:

```text
pnpm --filter @santashop/e2e run test:headed
pnpm run e2e:ui
pnpm run e2e:debug
pnpm --filter @santashop/e2e run test:report
```

The app and admin test servers both use port `4100`; never start both suites at once. The root E2E commands use `concurrently`, and each `e2e:test:app` or `e2e:test:admin` run invokes `firebase emulators:exec` through `e2e:emulators:exec:app` or `e2e:emulators:exec:admin`. `emulators:exec` owns the Firebase emulator lifecycle for that suite and tears the emulators down on success, failure, or timeout. Use the separate-terminal `e2e:emulators` workflow below when debugging or running an individual spec against long-lived emulators.

### Run one spec or test

For the validated full suite, use `e2e:test:app` or `e2e:test:admin`; these wrap `e2e:run:app`/`e2e:run:admin` in `firebase emulators:exec` and verify the callable readiness probe before Playwright starts. For a single spec or interactive debugging, prepare the target once, then use separate terminals because the emulator and dev server are long-lived:

```text
# Terminal 1
pnpm run e2e:prepare:app
pnpm run e2e:emulators

# Terminal 2
pnpm run e2e:serve:app

# Terminal 3
pnpm run e2e:functions:ready
pnpm --filter @santashop/e2e exec playwright test tests/public/account-access.spec.ts
pnpm --filter @santashop/e2e exec playwright test tests/public/account-access.spec.ts -g "AUTH-001"
```

Use `e2e:prepare:admin` and `e2e:serve:admin` for staff tests. `e2e:prepare:*` configures the selected app for E2E, configures Functions for local use, builds `@santashop/models`, builds `@santashop/core`, and builds Functions. If the target is a changed Functions helper, rerun the preparation step before testing.

## Understand the emulator contract

The root E2E orchestration is intentionally separate from the normal local emulator workflow:

| Service | E2E endpoint | Source of truth |
| --- | --- | --- |
| Functions | `127.0.0.1:5001` | `firebase.e2e.json` |
| Firestore | `127.0.0.1:8180` | `firebase.e2e.json` |
| Auth | `127.0.0.1:9099` | `firebase.e2e.json` |
| Storage | `127.0.0.1:9199` | `firebase.e2e.json` |
| App | `http://localhost:4100` | root serve script |

`firebase.e2e.json` must explicitly declare Functions runtime `nodejs22`. The package engine range and the emulator port being open do not prove that Functions loaded. `santashop-e2e/scripts/wait-for-functions.mjs` POSTs the callable envelope `{ data: {} }` to `testClearAllData` and retries until that real callable responds. Always run `pnpm run e2e:functions:ready` before diagnosing a Playwright failure as an app failure.

The E2E app configuration uses project `demo-santashop`, disables App Check, and connects the browser to the emulators in `santashop-app/src/main.ts` or `santashop-admin/src/main.ts`. The fixture calls Functions at:

```text
http://127.0.0.1:5001/demo-santashop/us-central1/<callable-name>
```

The fixture can read `E2E_EMULATOR_PROJECT`, and the readiness script can read `FUNCTIONS_EMULATOR_URL`, but the root `e2e:emulators` script is hard-coded to `demo-santashop`. Only override these values when the emulator, browser config, fixture, and readiness probe are all made consistent.

Do not mix `pnpm run emulators:start:local` with `pnpm run e2e:emulators` or the `firebase emulators:exec` E2E wrappers: the local flow uses a different project/configuration and Firestore port (`8080`), while the E2E app expects the E2E configuration and port `8180`. `pnpm run e2e:emulators` is the intentionally long-lived manual/debugging path; the automated suite uses `firebase emulators:exec --config firebase.e2e.json --project demo-santashop --only auth,firestore,functions,storage`.

## Seed and authenticate deterministically

Import `test` and `expect` from `santashop-e2e/fixtures/test-fixtures.ts`, not directly from `@playwright/test`, so tests get the repository's emulator fixtures.

Available fixtures map to emulator-only callable Functions:

- `clearData()` calls `testClearAllData`. It deletes the configured Firestore collections and all Auth users. It currently does not clear Storage; tests that write Storage need an explicit cleanup strategy or unique paths.
- `seedScenario(name)` calls `testSeedScenario`. Use `create-account-enabled`, `create-account-disabled`, `registration-closed`, `maintenance-mode`, or `weather-mode`.
- `seedPublicParams(params)` calls `testSeedPublicParameters`. Supply a complete nested `admin` or `globalAlert` object when testing that section because the helper merge is shallow.
- `seedAdminUser(user)` calls `testSeedAdminUser`. It creates an email-verified Auth emulator user and assigns `admin`, `owner`, and derived `roles` claims.
- `seedDateTimeSlots(slots)` calls `testSeedDateTimeSlots` for schedule and appointment cases. Keep `programYear`, dates, capacities, and enabled state aligned with the current generated E2E configuration.

Use the existing helpers before writing new flows:

- `fixtures/account-helpers.ts`: `randomAccount`, `createAccountViaUi`, `signInViaUi`, and sign-out/referral helpers.
- `fixtures/admin-helpers.ts`: `defaultAdminAccount`, `defaultOwnerAccount`, `signInAdminViaUi`, and Ionic input helpers.
- `fixtures/registration-helpers.ts`: referral, child, appointment, and submission flows.

For staff authentication, seed the account and then use the UI:

```typescript
import { test, expect } from '../../fixtures/test-fixtures';
import {
	defaultAdminAccount,
	signInAdminViaUi,
} from '../../fixtures/admin-helpers';

test('allows an admin into the workspace', async ({
	page,
	clearData,
	seedPublicParams,
	seedAdminUser,
}) => {
	await clearData();
	await seedPublicParams({});
	const account = defaultAdminAccount();
	await seedAdminUser(account);
	await signInAdminViaUi(page, account);
	await expect(page.locator('#scheduleEditorNav')).toBeVisible();
});
```

For customer authentication, prefer `randomAccount()` and `createAccountViaUi(page, account)`; verify protected-route redirects, sign-in, sign-out, and return access through the browser. Do not reuse a fixed customer email across tests unless the test deliberately proves duplicate-account behavior.

For a direct Firestore rules assertion, use the Auth emulator's `signInWithPassword` REST endpoint to obtain an ID token, then call the Firestore emulator REST endpoint with `Authorization: Bearer <idToken>`. Keep this pattern for rules tests such as `RULES-001`; it is not a replacement for testing the UI sign-in flow.

The emulator-only helpers are implemented in `santashop-functions/src/fn/testHelpers.ts` and exported from `santashop-functions/src/index.ts`. They must never be deployed or used as production APIs. Emulator Functions skip outbound SES delivery by default while preserving queued-email records. Set `SANTASHOP_SEND_EMAILS_FROM_EMULATOR=true` only for an intentional email-integration run with safe credentials and explicit approval.

## Write isolated, useful specs

1. Place customer specs under `santashop-e2e/tests/public/` and staff specs under `santashop-e2e/tests/admin/`; use `.spec.ts` names that describe the journey.
2. Add `test.beforeEach` cleanup and scenario seeding. Because all workers share mutable emulator state, keep `fullyParallel: false`, `workers: 1`, and `retries: 0` as configured. Do not add `test.describe.configure({ mode: 'parallel' })` for emulator-backed cases.
3. Seed only the state the test needs, then exercise the UI. Prove persistence after a route transition or a stable UI update when a Firestore write is asynchronous.
4. Prefer `getByRole`, `getByLabel`, exact `getByText`, existing stable IDs, and deliberate `data-*` attributes. Use Ionic host selectors only where the component does not expose a better semantic locator. Avoid asserting implementation-only CSS except for an explicit disabled-state contract.
5. Wait on observable outcomes: `waitForURL`, `toBeVisible`, `toHaveCount`, `toHaveValue`, `expect.poll`, or a domain-specific fixture/helper. Avoid arbitrary sleeps; retain a short wait only when the current UI renders before a known emulator write settles, and follow it with a persistence assertion.
6. Cover both positive and negative authorization paths. For admin claims, test ordinary admin, owner-only UI, non-admin denial, and unauthenticated redirects when the feature is protected.
7. Keep test data season-aware. Read the current program year from the repository configuration or `.env`; update static slot fixtures when the season rolls over instead of allowing stale dates to become an unexplained failure.
8. Keep test names tied to requirements or behavior, following the existing `AUTH-*`, `REG-*`, `STAFF-*`, `RULES-*`, `APPT-*`, and `SUB-*` convention.

Use this baseline for a public test:

```typescript
import { test, expect } from '../../fixtures/test-fixtures';
import {
	completeReferralViaUi,
	createAccountViaUi,
	randomAccount,
} from '../../fixtures/account-helpers';

test.describe('customer route access', () => {
	test.beforeEach(async ({ clearData, seedScenario }) => {
		await clearData();
		await seedScenario('create-account-enabled');
	});

	test('protects the registration overview after sign-out', async ({ page }) => {
		const account = randomAccount();
		await createAccountViaUi(page, account);
		await completeReferralViaUi(page);
		await page.goto('/pre-registration/overview');
		await expect(page).toHaveURL(/\/pre-registration\/overview$/);
	});
});
```

Use `page.goto('/')`/relative routes with the configured `baseURL`; use `E2E_BASE_URL` only when intentionally pointing at another already-running app server.

## Diagnose failures in order

- **Port 5001 is open but `testClearAllData` is missing:** rebuild Functions, confirm `firebase.e2e.json` has `runtime: "nodejs22"`, restart the E2E emulator, and run `pnpm run e2e:functions:ready`. Port readiness alone is insufficient.
- **The app reaches the wrong Firestore port:** regenerate with `pnpm run config:app:e2e` and use `firebase.e2e.json`; E2E Firestore is `8180`, not the local flow's `8080`.
- **Config preparation fails:** check the root `.env` for `SANTASHOP_PROGRAM_YEAR`, then rerun the target `e2e:prepare:*` command. Regenerate canonical config rather than editing generated files.
- **Auth sign-in fails:** confirm `clearData()` ran before seeding, call `seedAdminUser()` before `signInAdminViaUi()`, use the exact seeded email/password, and restart the dev server after changing generated config.
- **A staff page is visible to the wrong role:** verify both custom claims and app/rules/Functions enforcement. `admin: false` and `owner: false` should not be treated as an admin; an owner seed still includes admin capabilities through the helper's derived roles.
- **Email tests try to reach SES:** leave `SANTASHOP_SEND_EMAILS_FROM_EMULATOR` unset for normal E2E. Assert the user-facing queued/success behavior, not external delivery, unless the test is explicitly an email integration test.
- **Tests contaminate one another or become flaky:** keep one worker, clear Auth/Firestore in `beforeEach`, use unique customer accounts, avoid order dependence, and inspect whether the test writes Storage because the shared cleanup does not remove it.
- **Port conflicts occur:** stop stale processes using `4100`, `5001`, `8180`, `9099`, or `9199`, and run only one app/admin E2E orchestration at a time.
- **`spawn EPERM` appears from Angular/Playwright tooling:** first rerun the same targeted command in a permitted/elevated process context before changing application code; this can be a restricted-process artifact.

Inspect failures in `santashop-e2e/playwright-report/` and `santashop-e2e/test-results/`. The configured suite captures screenshots on failure, retains video on failure, and collects a trace on the first retry (retries are disabled by default, so enable a retry deliberately when trace collection is needed).

## Validate a new or changed test

Run the narrowest relevant spec first, then the containing suite:

```text
pnpm --filter @santashop/e2e exec playwright test tests/public/<file>.spec.ts
pnpm run e2e:test:app
pnpm run e2e:test:admin
```

When changing emulator helper Functions or their exports, also run:

```text
pnpm run functions:test:unit
pnpm run functions:test:integration
```

Review the generated config diff and `git status` after validation. Preserve unrelated working-tree changes, do not commit reports or emulator exports, and do not claim an E2E pass from a unit-test pass or from a listening emulator port alone.
