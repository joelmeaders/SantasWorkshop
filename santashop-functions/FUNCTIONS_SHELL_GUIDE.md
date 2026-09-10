# Firebase Functions shell

Use the shell only with verified emulators. Read the
[browser and data-safety procedure](../docs/browser-flow-testing.md) first.
Use the workspace's pinned Firebase CLI through `pnpm exec`; a global CLI is
not required.

## Prepare the emulator environment

From the workspace root, generate local configuration and build Functions:

```text
pnpm run config:functions:local
pnpm --filter @santashop/functions build
```

Use the [E2E guide](../docs/testing/e2e.md) to start Auth, Firestore, Functions,
and Storage with project `demo-santashop`. Confirm the selected project and
all emulator hosts before invoking a helper. A Functions shell on its own
does not establish that every backing service is an emulator.

## Callable request shape

Shell callable input requires a `data` wrapper:

```javascript
testSeedScenario({ data: { scenario: 'create-account-enabled' } });
testSeedPublicParameters({ data: { registrationEnabled: false } });
```

Use `testClearAllData({ data: {} })` only for disposable, verified emulator
fixtures. It deletes configured Firestore records, Auth users, and selected
Storage prefixes. See the [helper reference](src/fn/README.md) for scope.

The wrapper does not supply authentication or App Check. Production handlers
use Firebase v2 `CallableRequest` objects and validate their own data schema.
For authenticated customer/staff operations, use the actual app UI or the
existing emulator integration tests. Read the handler and shared model for
the current payload; do not infer fields from an old shell example.

## Triggers and schedules

`santashop-functions/src/index.ts` defines the exported v2 `onCall`,
`onDocumentCreated`, `onSchedule`, and task handlers. Create an isolated
emulator fixture to exercise a Firestore trigger. Updating an existing queue
document does not produce a creation event; recreating a missing document can.
See the [function call map](../docs/function-call-map.md) for runtime paths.

Schedule expressions come from generated runtime configuration. Do not treat
an old season's calendar or shell notes as the current schedule. Use the
handler's emulator integration test for deterministic scheduled-work checks.

## Owner operations and deployment

Annual exports, resets, and schedule initialization use **Admin → Owner
operations** and **Schedule & Capacity Editor**. Their previews, recent
authentication, exact confirmation phrase, seasonal restrictions, and task
progress are part of the supported workflow. The retired `pubsub*` maintenance
commands must not be used as a replacement.

See [yearly startup](../docs/yearly-startup.md) for the procedure and
`pnpm --filter @santashop/functions owner:manage` for owner provisioning.
Functions deployments run through the GitHub Actions release workflow.

Exit the shell with `.exit` or `Ctrl+C`. Save dated results in the project
vault, with the source revision, emulator project/hosts, and any limits.
