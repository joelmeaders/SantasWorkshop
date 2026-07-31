# SantaShop E2E Tests

End-to-end testing suite for the SantaShop application using Playwright.

## Prerequisites

- Node.js 24.11.0
- Firebase emulators
- santashop-functions built

## Setup

```bash
# Install dependencies (from root)
pnpm install

# Install Playwright browsers
pnpm --filter @santashop/e2e exec playwright install
```

## Running Tests

### Full E2E test suite

From the workspace root, this runs the public and admin suites sequentially.
Each run builds e2e/demo configuration, starts isolated Firebase emulators, serves
one application on port `4100`, runs its specs, and shuts its processes down:

```bash
pnpm e2e:test
```

For a faster feature-scoped run:

```bash
pnpm e2e:test:app
pnpm e2e:test:admin
```

### Manual testing

If you need more control, prepare the e2e/demo configuration and builds:

```bash
pnpm e2e:prepare:app
```

Then use separate terminals:

```bash
# Terminal 1
pnpm e2e:emulators

# Terminal 2
pnpm e2e:serve:app

# Terminal 3
pnpm e2e:run:app
```

### Development Mode

```bash
# Run tests with UI mode for debugging
pnpm --filter @santashop/e2e test:ui

# Run tests in headed mode (see browser)
pnpm --filter @santashop/e2e test:headed

# Debug tests step-by-step
pnpm --filter @santashop/e2e test:debug

# Generate test code
pnpm --filter @santashop/e2e test:codegen
```

### View Test Reports

```bash
pnpm --filter @santashop/e2e test:report
```

## Test Structure

- `tests/` - Test files
- `fixtures/` - Custom fixtures and test utilities
- `playwright.config.ts` - Playwright configuration

## Configuration

The tests are configured to:

- Run against `http://localhost:4100` (santashop-app test server)
- Use the `demo-santashop` Firebase emulators for backend services
- Run Functions on the explicit `nodejs22` emulator/deployment runtime while
  retaining Node 24 for workspace tooling
- Confirm an emulator-only callable loaded before Playwright begins
- Run one Chromium project with Playwright's Pixel 5 mobile profile
- Run sequentially in one worker because tests share emulator state
- Generate HTML reports
- Take screenshots on failure
- Record traces for debugging

## Writing Tests

Tests should be placed under the matching feature directory in `tests/public/`
or `tests/admin/` with the `.spec.ts` extension. Use the custom emulator
fixture rather than importing Playwright's base test directly.

Example:

```typescript
import { test, expect } from '../../fixtures/test-fixtures';

test('homepage loads', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/Santa/);
});
```

## CI/CD

The e2e tests can be integrated into your CI pipeline. Make sure to:

1. Build the functions project
2. Start Firebase emulators
3. Start the app in test mode
4. Run the e2e tests
5. Stop all services

The root `e2e:test`, `e2e:test:app`, and `e2e:test:admin` scripts handle this
orchestration.
