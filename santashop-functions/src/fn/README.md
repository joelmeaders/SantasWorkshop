# E2E Test Helper Functions

This directory contains helper functions for E2E testing with Firebase emulators.

## Functions

### Test Helper Functions

These functions are exposed as callable Firebase functions and should **ONLY** be used with emulators, never in production.

Available helper callables:

- `testSeedScenario`
- `testSeedPublicParameters`
- `testClearAllData`
- `testSeedAdminUser`
- `testSeedDateTimeSlots`

#### `testSeedScenario(scenario: string)`

Seeds the database with predefined test scenarios.

Available scenarios:

- `create-account-enabled` - Registration and create account enabled
- `create-account-disabled` - Registration enabled, create account disabled
- `registration-closed` - Registration disabled
- `maintenance-mode` - Maintenance mode enabled
- `weather-mode` - Weather mode enabled
- `default` - Everything enabled (default state)

#### `testSeedPublicParameters(params: object)`

Seeds custom public parameters. Accepts any fields from the `PublicParameters` interface:

- `registrationEnabled: boolean`
- `maintenanceModeEnabled: boolean`
- `weatherModeEnabled: boolean`
- `createAccountEnabled: boolean`
- `messageEn: string`
- `messageEs: string`

#### `testClearAllData()`

Clears all data from Firestore and Auth emulators. This includes:

- All Firestore collections (users, registrations, children, dateTimeSlots, parameters)
- All Auth users

#### `testSeedAdminUser({ emailAddress, password, uid?, admin? })`

Creates an Auth emulator user and applies custom claims. This is intended for
admin-app end-to-end sign-in flows.

- `emailAddress: string`
- `password: string`
- `uid?: string`
- `admin?: boolean` (defaults to `true`)

#### `testSeedDateTimeSlots({ slots })`

Seeds `dateTimeSlots` documents for schedule-editor tests.

Each slot supports:

- `id?: string`
- `programYear: number`
- `dateTime: string` (ISO string)
- `maxSlots: number`
- `slotsReserved?: number`
- `enabled?: boolean`
- `lastUpdated?: string` (ISO string)

## Usage in Tests

Use the fixtures provided in `test-fixtures.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';

test('my test', async ({ page, seedScenario, clearData }) => {
	// Clear data before test
	await clearData();

	// Seed a scenario
	await seedScenario('create-account-enabled');

	// Run your test
	await page.goto('/sign-up');
	// ...
});
```

## Implementation Details

The helper functions are implemented in:

- `santashop-functions/src/fn/testHelpers.ts` - Core helper logic
- `santashop-functions/src/index.ts` - Exported as callable functions
- `santashop-e2e/fixtures/test-fixtures.ts` - Playwright fixtures that call the functions

## Security

These functions do NOT have `enforceAppCheck` enabled, making them only suitable for emulator use. They should never be deployed to production environments.
