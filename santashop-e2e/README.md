# SantaShop E2E Tests

End-to-end testing suite for the SantaShop application using Playwright.

## Prerequisites

- Node.js 24.11.0 (managed by Volta)
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

### Full E2E Test Suite (Recommended)

From the root directory, this will build functions, start emulators, serve the app, and run tests:

```bash
pnpm e2e:test
```

### Manual Testing

If you need more control over the process:

```bash
# Terminal 1: Build functions and start emulators
cd santashop-functions
npm run build
cd ..
firebase use santas-workshop-test
firebase emulators:start --import .firebase

# Terminal 2: Start the app
pnpm --filter @santashop/app start:test

# Terminal 3: Run tests
pnpm --filter @santashop/e2e test
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
- Use Firebase emulators for backend services
- Run in parallel across multiple workers
- Generate HTML reports
- Take screenshots on failure
- Record traces for debugging

## Writing Tests

Tests should be placed in the `tests/` directory with the `.spec.ts` extension.

Example:

```typescript
import { test, expect } from '@playwright/test';

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

The `e2e:test` script handles this orchestration.
