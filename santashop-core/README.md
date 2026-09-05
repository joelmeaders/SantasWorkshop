# Shared Angular library

`santashop-core` contains shared services, Firebase wrappers, tokens, helpers,
and UI utilities. Public exports are in `src/index.ts`; entry-point folders
expose smaller consumer bundles. Shared record types belong in `santashop-models`.

Run commands from the workspace root:

```text
pnpm --filter @santashop/models build
pnpm --filter @santashop/core build:prod
pnpm --filter @santashop/core test
```

The test runner uses native Angular Vitest with headless Chromium. Install the
browser with `pnpm run test:browser:setup`. Build models and core before building
the customer or admin application. Use `test-helpers` for shared fixtures.
