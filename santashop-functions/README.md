## Firebase Functions

This package now uses the native Firebase Functions v2 APIs from `firebase-functions/v2/*`.

## Runtime requirement

- Firebase deploys for this package explicitly target the Node.js 22 runtime via `../firebase.json`.
- The package `engines.node` range still allows newer local Node versions so the workspace can keep using Node.js 24 for package-manager and general development workflows.

For the full cross-repo guide to secrets, client config, and environment flow, see `../docs/SECRETS_AND_CONFIGURATION.md`.

### Local configuration

Runtime configuration is loaded from environment variables instead of `functions.config()`.

- Prefer putting local values in the workspace root `.env` copied from `../.env.example`.
- `santashop-functions/.env` is still supported as a migration fallback for functions-only workflows, but the root `.env` is now the primary path.
- Generate project-specific Functions env files when needed with:
	- `pnpm run config:functions:test`
	- `pnpm run config:functions:prod`
- These commands write `santashop-functions/.env.<project-id>` files for Firebase CLI to load automatically during emulator and deploy flows.
- `firebase functions:config:get > .runtimeconfig.json` is no longer required for the current code path.

If prompted for webpack CLI install during local setup, cancel and run `npm link webpack` in the console.

### Emulator shell

Run pub/sub or callable functions manually during development with the Functions shell:

```text
firebase functions:shell
firebase > myCronFunction()
```

For callable functions in the shell, use the v2 request shape with a `data` wrapper.

Make sure new callable functions are added to `firebase.json`; otherwise local requests may be redirected and return invalid JSON.

## Tests

- Unit tests for Firebase Functions live under `santashop-functions/test/unit/` and run with Vitest:
	- `pnpm --filter @santashop/functions run test:unit`
- Emulator-backed integration tests live under `santashop-functions/test/integration/` and are orchestrated from the workspace root so the required Firebase emulators start automatically:
	- `pnpm run functions:test:integration`
- Run both slices together from the workspace root:
	- `pnpm run functions:test`

Integration tests currently exercise real Auth/Firestore/Storage emulator side effects by invoking handler modules directly. Production exports use native v2 callable, Firestore, scheduler, and Pub/Sub handlers.
