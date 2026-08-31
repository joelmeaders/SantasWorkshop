# Firebase Functions Shell Guide

This guide explains how to interact with different types of Firebase Functions using the Firebase Functions Shell.

## Starting the Functions Shell

```bash
firebase functions:shell
```

## Function Types and How to Call Them

### 1. Callable HTTPS Functions (onCall)

Callable functions use the `onCall` trigger and are called from client applications or the functions shell.

#### Syntax

```javascript
functionName({ data: { param1: 'value1', param2: 'value2' } });
```

**Important:** Data must be wrapped in a `data` property when calling from the shell.

#### Examples

**Test Helper Functions (Emulator Only):**

```javascript
// Seed database with a test scenario
testSeedScenario({ data: { scenario: 'create-account-enabled' } });

// Seed public parameters with custom values
testSeedPublicParameters({ data: { paramName: 'value', anotherParam: 123 } });

// Clear all test data (WARNING: Deletes all emulator data)
testClearAllData({ data: {} });
```

**Production Callable Functions:**

```javascript
// Create a new account
newAccount({ data: { email: 'user@example.com', name: 'John Doe' } });

// Complete registration
completeRegistration({ data: { registrationId: 'abc123' } });

// Update email address
updateEmailAddress({ data: { newEmail: 'newemail@example.com' } });

// Check in a user
checkIn({ data: { userId: 'user123' } });

// Undo registration
undoRegistration({ data: { registrationId: 'abc123' } });
```

### 2. Firestore Trigger Functions (onCreate, onUpdate, onDelete)

Firestore triggers automatically fire when documents are created, updated, or deleted. These cannot be directly called from the shell but will execute when you modify Firestore data in the emulator.

#### Example

```javascript
// This function triggers automatically when a document is created:
// sendNewRegistrationEmails - Triggers on: tmp_registrationemails/{docId} onCreate
```

To test, create a document in the emulator:

```javascript
// You would create the document through the Firestore emulator UI or using admin SDK
```

### 3. Scheduled Functions (pubsub.schedule)

Scheduled functions run on a cron schedule. They can be manually triggered in the shell.

#### Syntax

```javascript
functionName();
```

#### Examples

```javascript
// Run Firestore backup (normally runs at 00:00 in Nov & Dec)
scheduledFirestoreBackup();

// Update datetime slot counters (normally runs every 15 min in Nov & Dec)
scheduledDateTimeSlotCounters();

// Generate registration stats (normally runs at 23:59 daily)
scheduledRegistrationStats();

// Generate user stats (normally runs at 23:55 in Nov & Dec)
scheduledUserStats();

// Generate check-in stats (runs at specific times in December)
scheduledCheckInStats();
```

### 4. Owner Operations

The former Pub/Sub maintenance handlers have been retired. Their supported
replacements are authenticated, App-Check-protected callables exposed through
the admin app's **Owner operations** area. Do not invoke these workflows from
the Functions shell: previews, recent authentication, exact confirmation
phrases, seasonal restrictions, single-use records, and task progress are all
part of the security contract.

Provision or transfer an owner with `pnpm --filter @santashop/functions
owner:manage`. See [`../docs/yearly-startup.md`](../docs/yearly-startup.md) for
the yearly export, verified backup, purge, archive, schedule initialization, and
deployment workflow.

## Common Patterns

### Calling with Authentication Context

When using the emulator, callable functions receive a `context` parameter that includes auth information. In production, this is automatically provided by Firebase. In the shell, you can't easily mock this, so test with actual authenticated users in the emulator.

### Checking Function Results

All callable functions return a promise that resolves to the function's return value:

```javascript
testSeedScenario({ data: { scenario: 'create-account-enabled' } }).then(
	(result) => {
		console.log('Result:', result);
	},
);
```

### Error Handling

If a function throws an error, it will be displayed in the shell:

```javascript
someFunction({ data: {} }).catch((error) => {
	console.error('Error:', error);
});
```

## Tips

1. **Use `.exit` or `Ctrl+C` to exit the shell**
2. **Functions reload automatically** when you save changes to your code
3. **Environment variables** can be set using `santashop-functions/.env` (or the workspace root `.env`)
4. **Emulator data** persists between shell sessions unless you clear it
5. **AppCheck is disabled** for test helper functions to allow easy testing

## Related Commands

```bash
# Start all emulators
firebase emulators:start

# Start only functions emulator
firebase emulators:start --only functions

# Functions deployment is intentionally GitHub Actions-only.
# Merge to master for test, then promote the tested ref with the release workflow.
```
