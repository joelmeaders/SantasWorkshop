# Santa's Workshop

A monorepo for Santa's Workshop registration and management applications.

## Workspace Structure

```
santasworkshop/
├── santashop-app/        # Customer-facing registration app (Ionic/Angular)
├── santashop-admin/      # Admin dashboard (Ionic/Angular)
├── santashop-core/       # Shared Angular library
├── santashop-models/     # Shared data models
├── santashop-functions/  # Firebase Cloud Functions
└── santashop-e2e/        # End-to-end tests (Playwright)
```

## Prerequisites

- **Node.js 24.11+**: Install Node.js 24 locally for general shell usage. Versions below Node 24 are unsupported in this repository. The repo also pins `24.11.0` in `.nvmrc` and `.node-version`, and `.npmrc` enforces the floor during package-manager operations with `engine-strict=true` plus `use-node-version=24.11.0`. When running workspace scripts through pnpm, the root `devEngines.runtime` setting can also auto-download a compatible Node.js version.
- **pnpm**: v10.14 or later (required for `devEngines.runtime` feature)

`pnpm-lock.yaml` may still contain `node >=20` or `^20` ranges inside third-party package metadata. Those are upstream dependency compatibility declarations, not this repository's runtime policy.

## Dependency Management

This workspace uses **pnpm Catalogs** for centralized dependency version management.

### Catalogs

| Catalog | Purpose | Used By |
|---------|---------|---------|
| `catalog:` (default) | Angular/Ionic dependencies | app, admin, core, models, root |
| `catalog:functions` | Cloud Functions dependencies | santashop-functions |

### How It Works

Dependencies are defined once in `pnpm-workspace.yaml`:

```yaml
# Default catalog
catalog:
  "@angular/core": ^21.0.6
  "@ionic/angular": ^8.7.15
  firebase: ^12.7.0
  # ...

# Functions-specific catalog  
catalogs:
  functions:
    firebase-admin: ^13.6.0
    firebase-functions: ^6.6.0
    # ...
```

Then referenced in `package.json` files:

```json
{
  "dependencies": {
    "@angular/core": "catalog:",
    "firebase": "catalog:"
  }
}
```

For functions:
```json
{
  "dependencies": {
    "firebase-admin": "catalog:functions"
  }
}
```

### Benefits

- **Single source of truth** - Update versions in one place
- **Easier upgrades** - Change one line instead of many
- **Fewer merge conflicts** - No version changes in package.json files
- **Automatic cleanup** - Unused catalog entries are removed during install

## Development

### Install Dependencies

```bash
pnpm install
```

### Configure Environment Variables

Copy `.env.example` to `.env` and fill in any local-only placeholders.

The committed `.env.example` and any checked-in `src/firebase.config.ts` placeholders intentionally avoid real Firebase web API keys. Generate real config locally or in CI before building.

For the full explanation of what is public config vs true secrets, how values flow through app/admin hosting and Firebase Functions, and the step-by-step instructions for setting up local, test, and production secrets, see `docs/SECRETS_AND_CONFIGURATION.md`.

The shared Angular config generator uses the same variable contract in every environment:

- `TEST_FIREBASE_*` for local development, QA, preview, and test builds
- `PROD_FIREBASE_*` for production builds

For the Angular CLI build profile, local development and the current test/QA app/admin scripts both use the `development` configuration. The behavioral difference between **dev** and **test** comes from the generated `src/config.ts` / `src/firebase.config.ts` files and the Firebase project they point to, not from a different Angular CLI optimization profile.

Generate the Firebase client modules manually when needed:

```bash
pnpm run config:app:dev
pnpm run config:admin:dev
pnpm run config:app:test
pnpm run config:admin:test
pnpm run config:app:prod
pnpm run config:admin:prod
```

Generated files:

- `santashop-app/src/config.ts`
- `santashop-app/src/firebase.config.ts`
- `santashop-admin/src/config.ts`
- `santashop-admin/src/firebase.config.ts`

Each app now uses one root `src/config.ts` metadata file plus a generated `src/firebase.config.ts` file.

### Sync GCP Secret Manager from `.env`

If you want to create or update Google Cloud Secret Manager values from the root `.env` file, use:

```bash
pwsh ./scripts/gcloud-secrets.ps1
```

Useful variants:

```bash
pwsh ./scripts/gcloud-secrets.ps1 -Environment test
pwsh ./scripts/gcloud-secrets.ps1 -Environment prod
pwsh ./scripts/gcloud-secrets.ps1 -WhatIf
```

The script reads `.env`, prefers `TEST_...` or `PROD_...` overrides when available, and writes secrets into the correct GCP project using `gcloud`.

If your repository host or cloud vendor invalidates exposed web API keys, treat `src/firebase.config.ts` as an ephemeral generated file containing placeholders in Git and real values only in local or CI-generated working trees.

### Sync GitHub Actions secrets from `.env`

If you want to create or update the GitHub Actions secrets used by the workflows, use:

```bash
pwsh ./scripts/github-secrets.ps1
```

Preview the operations without writing:

```bash
pwsh ./scripts/github-secrets.ps1 -WhatIf
```

The script reads the root `.env`, resolves the workflow secret names, and writes them with the GitHub CLI (`gh secret set`).

### Build Applications

```bash
# Build customer app
pnpm run app:build

# Build admin app
pnpm run admin:build
```

### Run Emulators

```bash
pnpm run emulators:start
```

### Run E2E Tests

```bash
pnpm run e2e:test
```

## Deployment

### Hosting Builds in GitHub Actions

- Pull request workflows now validate app/admin builds in **test** mode, but do not deploy.
- Merge-to-master workflows deploy the merged commit to the **test** Firebase project first.
- Production release is a separate manual workflow run that promotes a specific tested commit or ref to the **production** Firebase project.
- When you are ready for prod, run the workflow manually and provide the tested commit SHA or ref as `release_ref`.

Current app/admin PR and test-deploy workflows generate **test-mode** Angular config (`config.production === true`) and then build with Angular CLI's `development` configuration. Production workflows use Angular CLI's `production` configuration.

Required GitHub secrets for the current hosting workflows:

- `TEST_FIREBASE_API_KEY`
- `PROD_FIREBASE_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

### Functions Deploys in GitHub Actions

Functions now have dedicated test and production workflow files:

- `.github/workflows/functions-pr-validation.yml`
- `.github/workflows/functions-test-and-prod-release.yml`

The pull request workflow acts as the Functions PR validation process:

- unit tests always run on matching PRs
- integration tests run when the required test secrets are available

The merge-to-master workflow is now the Functions promotion pipeline:

- it deploys to the **test** Firebase project first
- production release is then triggered manually for the tested commit or ref
- the manual run deploys that ref to the **production** Firebase project

Required GitHub secrets for the Functions workflows:

- `TEST_AWS_ACCESS_KEY_ID`
- `TEST_AWS_SECRET_ACCESS_KEY`
- `PROD_AWS_ACCESS_KEY_ID`
- `PROD_AWS_SECRET_ACCESS_KEY`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

### Deploy Functions

```bash
# Test environment
pnpm run functions:deploy:test

# Production
pnpm run functions:deploy:prod
```
