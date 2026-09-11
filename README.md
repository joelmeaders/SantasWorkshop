# Santa's Workshop

See the [documentation index](docs/README.md) for maintained architecture,
requirements, testing, and operating procedures. Dated release and QA records
must be created directly in the project Obsidian vault. Follow the
[recording policy](docs/README.md#recording-future-work) for its path and topic folders.

A monorepo for Santa's Workshop registration and management applications.

Develop and test selected states of both apps in isolation with [Storybook](docs/storybook.md). The catalog itself is the UI inventory; stories protect meaningful rendering, interaction, and accessibility behavior rather than satisfying a component-count target.

Read the [runtime call boundaries](docs/function-call-map.md) before changing callables, Firestore triggers, queue writes, task continuations, or schedules. Focused runtime tests protect email update-only writes and owner-worker deadlines/lock ownership; there is no broad source-hash approval gate.

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

- **Node.js 24.15+**: Install Node.js 24 locally for general shell usage. Versions below Node 24.15 are unsupported in this repository. The repo pins `24.18.0` in `.nvmrc`, and `.npmrc` enforces it during package-manager operations with `engine-strict=true` plus `use-node-version=24.18.0`. When running workspace scripts through pnpm, the root `devEngines.runtime` setting can also auto-download a compatible Node.js version.
- **pnpm**: v10.14 or later (required for `devEngines.runtime` feature)

`pnpm-lock.yaml` may still contain `node >=20` or `^20` ranges inside third-party package metadata. Those are upstream dependency compatibility declarations, not this repository's runtime policy.

## Dependency Management

This workspace uses **pnpm Catalogs** for centralized dependency version management.

### Catalogs

| Catalog              | Purpose                      | Used By                        |
| -------------------- | ---------------------------- | ------------------------------ |
| `catalog:` (default) | Angular/Ionic dependencies   | app, admin, core, models, root |
| `catalog:functions`  | Cloud Functions dependencies | santashop-functions            |

### How It Works

Dependencies are defined once in `pnpm-workspace.yaml`:

```yaml
catalog:
    '@angular/core': 22.1.0
    '@ionic/angular': 8.8.14
    firebase: 12.18.0

catalogs:
    functions:
        firebase-admin: ^13.10.0
        firebase-functions: ^7.3.2
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

Each app uses one root `src/config.ts` metadata file plus a generated `src/firebase.config.ts` file.

### Sync GitHub Actions secrets from `.env`

The [configuration guide](docs/SECRETS_AND_CONFIGURATION.md#synchronize-repository-secrets) owns the required secret names and safe synchronization procedure. Both deployed projects use scoped SES credentials. The helper supports `-WhatIf`, validates all required input before writing, and does not pass secret values in command arguments or diagnostics.

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

- The UI PR workflow runs core tests, selects the affected app/admin targets, and requires every selected/shared job through `build_validation`. Target jobs validate **test**-mode builds and emulator journeys without deployment. The canonical Storybook workflow owns behavior tests and the separate Windows visual job.
- Merge-to-master workflows deploy the merged commit to the **test** Firebase project first.
- Production release is a separate owner-dispatched workflow from `master`. Set `release_ref` to a full 40-character commit SHA on `master`.
- Supply `evidence_run_ids` for successful validation and test deployment of that exact SHA. Repeat the SHA in `production_approval` to approve the selected runs. The shared gate verifies evidence before candidate execution or production credentials.
- `skip_tests=true` reuses verified tests. It cannot bypass the gate. See [the release procedure](docs/release-readiness.md#exact-sha-release-evidence-and-owner-approval) for required runs, path-filter gaps, and rollback reuse.

Current app/admin PR and test-deploy workflows generate **test-mode** Angular config (`config.production === true`) and then build with Angular CLI's `development` configuration. Production workflows use Angular CLI's `production` configuration.

Required GitHub secrets for the current hosting workflows:

- `TEST_FIREBASE_API_KEY`
- `PROD_FIREBASE_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

### Functions Deploys in GitHub Actions

Functions have dedicated test and production workflow files:

- `.github/workflows/functions-pr-validation.yml`
- `.github/workflows/functions-test-and-prod-release.yml`

The pull request workflow acts as the Functions PR validation process:

- unit tests always run on matching PRs
- integration tests run when the required test secrets are available

The merge-to-master workflow is the Functions promotion pipeline:

- it deploys to the **test** Firebase project first
- the owner then dispatches production from `master` with the full tested SHA, evidence run IDs, and matching approval
- the shared gate verifies unit, integration, customer/staff E2E, and test-deployment evidence before deploying that SHA to **production**

Required GitHub secrets for the Functions workflows:

- `TEST_AWS_ACCESS_KEY_ID`
- `TEST_AWS_SECRET_ACCESS_KEY`
- `PROD_AWS_ACCESS_KEY_ID`
- `PROD_AWS_SECRET_ACCESS_KEY`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

Functions deploys are GitHub Actions-only. Direct local `firebase deploy --only functions` commands are rejected by the Functions predeploy guard. Merge to `master` to deploy test, validate that environment, and then manually promote the tested `release_ref` to production.

The workspace keeps Functions dependencies in the pnpm `catalog:functions`
catalog. Before Firebase uploads source, the release builds a disposable
`.firebase-functions-deploy` artifact with the compiled runtime, concrete
installed dependency versions, an npm lockfile, and only the generated
project-specific Functions environment file. Developer-local `.env` files are
never packaged. The artifact installs its production dependencies so Firebase
CLI can analyze it before upload, while Cloud Build still receives the
reproducible npm lockfile. This keeps the workspace catalog authoritative.
Never point Firebase directly at the catalog-based
`santashop-functions/package.json`.

The test backend release deploys Firestore rules/indexes and Storage rules,
removes retired Functions, and fails if the live Function inventory does not
exactly match source. The test project's unused Realtime Database instance is
disabled, so Realtime Database rules are deployed only by the manual production
release, where the instance is active. See
[`docs/release-readiness.md`](docs/release-readiness.md) for capacity profiles,
warm-instance cost controls, load gates, monitoring, backup/restore checks, and
the accepted overbooking policy.
