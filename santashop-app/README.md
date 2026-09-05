# Customer application

The standalone Angular/Ionic application provides customer account creation,
registration, appointment selection, and confirmation. See the
[architecture](../docs/app/ARCHITECTURE_OVERVIEW.md) and root README.

From the workspace root:

```text
pnpm run dev:app:local
pnpm --filter @santashop/app lint
pnpm --filter @santashop/app test
pnpm run e2e:test:app
```

Local development uses Firebase emulators. The root scripts generate
configuration and build the shared libraries. Both E2E application servers use
port 4100, so run customer and admin suites sequentially.
