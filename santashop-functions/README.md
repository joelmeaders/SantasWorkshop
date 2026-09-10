# Firebase Functions

This package uses Firebase Functions v2 callable, Firestore, scheduler, and task
handlers. Firebase configuration selects `nodejs24`; local tooling requires
Node.js 24.15 or later. Use the workspace pnpm commands.

## Configuration

Copy the root `.env.example` to the ignored root `.env` and set explicit
`LOCAL_`, `TEST_`, or `PROD_` inputs for the selected target. The root generator
writes a project-specific dotenv file; Firebase supplies its unprefixed values
through `process.env`. See [configuration](../docs/SECRETS_AND_CONFIGURATION.md).
Functions deployment runs through GitHub Actions and its predeploy guard.

## Validation

Read the [function call map](../docs/function-call-map.md) when changing call paths, helper code, queue writes, triggers, or schedules. Run `pnpm run functions:graph:test` and `pnpm run functions:graph:check` from the workspace root. Review changed paths and update the semantic edges before recording the review with `pnpm run functions:graph:update`. Source hashes make unreviewed changes fail CI.

`pnpm run functions:cycles` is the strict check. It reports the retained owner-worker continuation, which has a one-hour backup wait budget from the operation creation time. A persisted purge marker keeps retries of partial resets separate from this deadline. The email handler updates existing queue records and does not recreate deleted records. CI checks for regressions; it does not certify that the graph is acyclic. Before deploying over an older revision, inspect active yearly resets that may lack the new purge marker; see the [call map](../docs/function-call-map.md).

```text
pnpm --filter @santashop/functions lint
pnpm --filter @santashop/functions test:unit
pnpm --filter @santashop/functions build
pnpm run functions:test:integration
```

Integration tests invoke handlers with real Auth, Firestore, and Storage
emulators. Emulator email sending is disabled by default. Published template
keys and explicit mappings are required for template sends.

For manual emulator calls, see [Functions shell](FUNCTIONS_SHELL_GUIDE.md).
Callable requests use a `data` wrapper. Keep Hosting rewrites in `firebase.json`
aligned with exported callable endpoints.
