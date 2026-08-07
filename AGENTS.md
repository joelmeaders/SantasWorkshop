# AGENTS.md

## Scope

This repository is a `pnpm` monorepo for Santa's Workshop applications and Firebase backends. Prefer workspace-root commands unless a package README says otherwise.

## Language and tooling

- Keep repository code, scripts, and configuration in TypeScript/JavaScript and Node.js tooling. Do not introduce a second language runtime or package manager.

## Monorepo map

| Path | Role | Notes |
| --- | --- | --- |
| `santashop-app/` | Customer-facing Ionic/Angular app | Standalone Angular app with Firebase + Ionic |
| `santashop-admin/` | Admin Ionic/Angular app | Similar stack, separate routes and deploy flow |
| `santashop-core/` | Shared Angular library | Shared services, helpers, tokens, pipes, decorators |
| `santashop-models/` | Shared model library | Cross-project TypeScript data models |
| `santashop-functions/` | Firebase Cloud Functions | Webpack-built Node functions |
| `santashop-e2e/` | Playwright tests | End-to-end coverage for the app flow |
| `test-helpers/` | Shared unit-test helpers | Reuse mocks/providers before creating new ones |

## Working rules

- Install dependencies with `pnpm install`.
- Dependency versions are centralized in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) via `catalog:` references. When changing package versions, update the catalog instead of leaf `package.json` files.
- `santashop-app` and `santashop-admin` depend on fresh builds of `@santashop/models` and `@santashop/core`. Use the root build scripts in [`package.json`](package.json) or run the package `prebuild` script before app/admin builds.
- Keep validation scoped to the package you changed. Prefer targeted lint/test/build runs over full-workspace or e2e runs unless the task truly crosses package boundaries.
- Root ESLint is strict: explicit return types and member accessibility are expected, unused vars are errors, and Angular component classes must end in `Page` or `Component`. See [`eslint.config.js`](eslint.config.js).

## Angular and Ionic conventions

- This repo uses standalone Angular bootstrap and routing, not `NgModule`-based app setup. Follow the patterns in [`santashop-app/src/main.ts`](santashop-app/src/main.ts) and [`santashop-app/src/app/app.routes.ts`](santashop-app/src/app/app.routes.ts).
- Prefer consistency with nearby code over introducing a new architecture. The apps are heavily RxJS/observable-first even on modern Angular versions.
- Use lazy `loadComponent()` routes and existing guard patterns where applicable.
- The pinned Ionic Angular dev build exposes its standalone APIs from `@ionic/angular`; use that package root for Ionic standalone UI imports.
- Shared Angular exports live in [`santashop-core/src/index.ts`](santashop-core/src/index.ts) and shared models in [`santashop-models/src/index.ts`](santashop-models/src/index.ts). Check those public APIs before adding new cross-project utilities.

## Testing and validation

- Unit tests use Angular's native Vitest runner in headless Chromium with coverage and watch disabled in [`angular.json`](angular.json). Run `pnpm run test:browser:setup` once when Chromium is not installed.
- Typical scoped commands:
  - `pnpm --filter @santashop/app lint`
  - `pnpm --filter @santashop/app test`
  - `pnpm --filter @santashop/admin lint`
  - `pnpm --filter @santashop/admin test`
  - `ng test santashop-core`
- Reuse helpers from [`test-helpers/`](test-helpers/) before introducing new mocks or test utilities.
- End-to-end orchestration lives in the root [`package.json`](package.json) and package docs at [`santashop-e2e/README.md`](santashop-e2e/README.md). Note that both app and admin `start:test` scripts use port `4100`, so only run one test server at a time.

## Firebase and functions gotchas

- Emulator-oriented scripts target the `santas-workshop-test` Firebase project; start with the root [`README.md`](README.md) for setup.
- `santashop-functions` uses webpack and declares Node `24`, matching the root workspace Node `24` floor for app/tooling workflows. Check the relevant package before changing runtime-sensitive code.
- In the Functions shell, callable functions must be invoked with a `data` wrapper such as `myFunction({ data: { ... } })`. See [`santashop-functions/FUNCTIONS_SHELL_GUIDE.md`](santashop-functions/FUNCTIONS_SHELL_GUIDE.md).
- If a new callable function or rewrite behaves like a hosting redirect locally, verify the relevant entries in [`firebase.json`](firebase.json).

## Good reference files

- [`README.md`](README.md) — workspace overview, prerequisites, and root workflows
- [`package.json`](package.json) — root scripts for builds, emulators, deployment, and e2e
- [`angular.json`](angular.json) — project names, build/test targets, and configurations
- [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — workspace packages and dependency catalogs
- [`santashop-app/README.md`](santashop-app/README.md) and [`santashop-core/README.md`](santashop-core/README.md) — package-specific notes
- [`santashop-e2e/README.md`](santashop-e2e/README.md) — Playwright workflow and report usage
- [`santashop-functions/FUNCTIONS_SHELL_GUIDE.md`](santashop-functions/FUNCTIONS_SHELL_GUIDE.md) — callable/scheduled function testing patterns
