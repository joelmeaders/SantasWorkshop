# E2E Test Helper Functions

This directory contains helper functions for E2E testing with Firebase emulators.

## Functions

### Test Helper Functions

These functions are exposed as callable Firebase functions and should **ONLY** be used with emulators, never in production.

Common helper callables (see `src/index.ts` for the complete export list):

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

Seeds `_testConfig/publicParameters` in verified emulators. It merges complete
nested defaults and validates the `PublicParameters` schema. Fields include:

- `registrationEnabled: boolean`
- `maintenanceModeEnabled: boolean`
- `weatherModeEnabled: boolean`
- `createAccountEnabled: boolean`
- `messageEn: string`
- `messageEs: string`
- `admin`: staff operating controls
- `globalAlert`: bilingual alert content and display control

#### `testClearAllData()`

Clears configured test data in verified emulators. This includes:

- Documents in the explicitly listed Firestore collections, including `_testConfig`
- Auth users returned by the cleanup helper
- Storage objects under `registrations/` and `emailTemplates/`

This is not a general recursive or bucket-wide cleanup tool. The exact collection
list is in `clearAllData` in `testHelpers.ts`. Use isolated fixtures and verify
cleanup results when a test creates nested data.

#### `testSeedAdminUser({ emailAddress, password, uid?, roles?, owner? })`

Creates an Auth emulator user and applies custom claims. This is intended for
admin-app end-to-end sign-in flows.

- `emailAddress: string`
- `password: string`
- `uid?: string`
- `roles?: ('admin' | 'checkin')[]` (defaults to both roles)
- `owner?: boolean` (separate owner capability)

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
