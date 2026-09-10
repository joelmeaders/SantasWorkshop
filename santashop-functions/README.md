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

Read the [runtime call boundaries](../docs/function-call-map.md) when changing helpers, queue writes, triggers, or schedules. Preserve the sender's update-only writes and the owner's bounded backup wait, persisted purge marker, terminal handling, and operation-ID-checked lock cleanup. Run the focused regression tests and affected emulator journeys. These checks do not certify acyclicity or deployed behavior.

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
