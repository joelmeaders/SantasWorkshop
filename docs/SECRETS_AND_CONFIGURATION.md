# Secrets and Configuration Guide

This guide explains what configuration exists in Santa's Workshop, which values are true secrets, how values flow through the Angular apps and Firebase Functions, and how to work with them in local development, the test environment, and production.

## Quick mental model

There are **two different configuration flows** in this repo:

1. **Angular app/admin client configuration**
   - Build-time configuration
   - Generated into `src/config.ts` and `src/firebase.config.ts`
   - Used by `santashop-app` and `santashop-admin`
   - Dev, test, and prod are selected by generator mode

2. **Firebase Functions server configuration**
   - Runtime configuration
   - Read from environment variables by `santashop-functions/src/utility/runtime-config.ts`
   - Used by deployed Functions and the emulator

### Public client config

These values are used by the Firebase web SDK in the browser and are **public at runtime**:

- `*_FIREBASE_API_KEY`
- `*_FIREBASE_AUTH_DOMAIN`
- `*_FIREBASE_DATABASE_URL`
- `*_FIREBASE_PROJECT_ID`
- `*_FIREBASE_STORAGE_BUCKET`
- `*_FIREBASE_MESSAGING_SENDER_ID`
- `*_FIREBASE_APP_ID`
- `*_FIREBASE_MEASUREMENT_ID`

These values still matter, but they are **not secrets in the cryptographic sense**. They end up in the built web app and can be inspected by users. Security comes from:

- Firebase Auth / Firestore / Storage rules
- App Check
- project separation between test and prod
- service account permissions

### Real secrets

These values should be treated as true secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- GitHub Actions service account secrets such as:
  - `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
  - `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

## Files involved

### Angular app/admin

- Root env template: `.env.example`
- Local env file: `.env`
- Shared generator: `config.firebase.cjs`
- Generated outputs:
  - `santashop-app/src/config.ts`
  - `santashop-app/src/firebase.config.ts`
  - `santashop-admin/src/config.ts`
  - `santashop-admin/src/firebase.config.ts`
- App bootstraps:
  - `santashop-app/src/main.ts`
  - `santashop-admin/src/main.ts`

### Firebase Functions

- Local env file: `.env` at workspace root
- Generated project env files:
  - `santashop-functions/.env.santas-workshop-test`
  - `santashop-functions/.env.santas-workshop-193b5`
- Legacy fallback: `santashop-functions/.env`
- Runtime loader: `santashop-functions/src/utility/runtime-config.ts`
- Package docs: `santashop-functions/README.md`
- Deploy scripts: root `package.json`

### GitHub Actions

- App PR validation: `.github/workflows/app-pr-validation.yml`
- App promote-after-test pipeline: `.github/workflows/app-test-and-prod-release.yml`
- Admin PR validation: `.github/workflows/admin-pr-validation.yml`
- Admin promote-after-test pipeline: `.github/workflows/admin-test-and-prod-release.yml`
- Functions PR validation: `.github/workflows/functions-pr-validation.yml`
- Functions promote-after-test pipeline: `.github/workflows/functions-test-and-prod-release.yml`
- Manual production promotion is done with `workflow_dispatch` using a required `release_ref` input

### Secret Manager sync tooling

- PowerShell sync script: `scripts/gcloud-secrets.ps1`
- GitHub Actions secrets sync script: `scripts/github-secrets.ps1`

### Practical policy for this repo

- `.env.example` should contain placeholder Firebase API keys only
- `.env` should contain real local values
- GitHub Actions secrets should contain the real CI values
- checked-in `src/firebase.config.ts` should contain placeholders only, or the file should be ignored entirely
- the generator should always run before real builds

You can sync the GitHub Actions secrets directly from `.env` with `scripts/github-secrets.ps1`.

## How configuration flows through the Angular apps

### 1. Source of truth

The Angular config generator reads environment variables.

For local dev and test usage, it reads:

- `TEST_FIREBASE_API_KEY`
- `TEST_FIREBASE_AUTH_DOMAIN`
- `TEST_FIREBASE_DATABASE_URL`
- `TEST_FIREBASE_PROJECT_ID`
- `TEST_FIREBASE_STORAGE_BUCKET`
- `TEST_FIREBASE_MESSAGING_SENDER_ID`
- `TEST_FIREBASE_APP_ID`
- `TEST_FIREBASE_MEASUREMENT_ID`

For production, it reads the matching `PROD_FIREBASE_*` values.

### 2. Generation step

`config.firebase.cjs` writes **two files per app**:

- `src/config.ts`
- `src/firebase.config.ts`

For example, for `santashop-app` it generates:

- `santashop-app/src/config.ts`
- `santashop-app/src/firebase.config.ts`

These files are generated artifacts. Do not edit them manually.

When checked into Git, `src/firebase.config.ts` should be treated as a placeholder-safe snapshot, not as the source of truth for real API keys.

### 3. What each generated file does

`src/config.ts` contains app metadata:

- `production`
- `label`
- `name`
- `version`
- `appCheckKey`

`src/firebase.config.ts` contains Firebase client connection info:

- API key
- auth domain
- database URL
- project ID
- storage bucket
- messaging sender ID
- app ID
- measurement ID

## How configuration flows through Firebase Functions

Firebase Functions use runtime environment variables, not generated TypeScript config files.

There are now two layers in the Functions flow:

1. the root `.env` file is the human-edited source of truth
2. `config.functions.cjs` can generate project-specific env files for Firebase CLI

`runtime-config.ts` behaves like this:

1. it honors already-set `process.env` values first and never overwrites them
2. if a value is still missing, it probes env files in this order:
  - the current working directory `.env`
  - the current working directory `santashop-functions/.env`
  - relative fallback paths from the compiled module so repo-root `.env` still works when the process starts deeper in the tree
3. it reads `FIREBASE_CONFIG` for Firebase project metadata fallback such as `projectId` or `storageBucket`
4. for `SES_REGION`, it also accepts `AWS_REGION` as a runtime fallback when `SES_REGION` is not set

This means Functions configuration is resolved **at runtime**, not at web-app build time.

For test and production deploy/emulator flows, the generated files:

- `santashop-functions/.env.santas-workshop-test`
- `santashop-functions/.env.santas-workshop-193b5`

let Firebase CLI load the correct unprefixed runtime variables for the selected project. Because Firebase CLI injects those values into `process.env` before Functions start, they take precedence over the fallback file loading above.

## Angular build configuration versus generated app mode

The repo now separates **Angular CLI build configuration** from the generated app mode written into `src/config.ts`:

- **dev mode** generates `config.production = false`
- **test mode** generates `config.production = true`
- **prod mode** generates `config.production = true`

Today, the app/admin scripts use Angular CLI like this:

- local **dev** scripts use `--configuration=development`
- current **test/QA** scripts and CI jobs also use `--configuration=development`
- **prod** scripts use `--configuration=production`

So dev and test currently share the same Angular CLI build profile. The runtime behavior still differs because the generated `src/config.ts` changes emulator wiring, `enableProdMode()`, App Check debug-token behavior, labels, and which Firebase project the generated client config points at.

## Local development

### Step 1: create your local env file

Copy:

- `.env.example` -> `.env`

Then fill in local-only values such as:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Also replace placeholder Firebase API key values in your local `.env` with real ones before generating config.

### Step 2: understand your three environments

You now have these app-level modes:

- **dev** = local machine behavior, `production: false`, but still pointed at the **test Firebase project**
- **test** = test/QA/preview behavior, `production: true`, pointed at the **test Firebase project**
- **prod** = production behavior, `production: true`, pointed at the **prod Firebase project**

This is usually the cleanest split:

- dev and test share the same Firebase backend project
- prod uses a separate Firebase project
- dev still behaves like local development because `config.production` is false

### Step 3: generate app/admin config for local dev

Use:

```text
pnpm run config:app:dev
pnpm run config:admin:dev
```

Or use app-level scripts that already do it for you:

```text
pnpm --filter @santashop/app start
pnpm --filter @santashop/admin start
```

### Step 4: what happens in local dev

For the Angular apps:

- `src/config.ts` has `production: false`
- Firebase emulators are connected in `main.ts`
- App Check debug token support is enabled
- Firebase client values still come from the **test Firebase variable set**
- the Angular CLI build profile is still `development`

For Functions:

- the emulator reads runtime values from `.env`
- `santashop-functions/.env` can still work, but root `.env` is preferred
- root scripts now generate `santashop-functions/.env.santas-workshop-test` before emulator-backed runs so Functions use the test project configuration consistently

## Test environment

In this repo, “test” now means:

- Angular app/admin merged test deployment or QA build
- test Firebase Hosting target/project
- `production: true` behavior in generated `src/config.ts`
- the same Angular CLI `development` build configuration currently used by local dev scripts
- Firebase client values from `TEST_FIREBASE_*`

### Angular test deployment after merge

For app/admin promote-after-test deployments in GitHub Actions:

- the **test Firebase project** is used: `santas-workshop-test`
- the workflows inject `TEST_FIREBASE_*` values
- the merge workflows run:
  - `pnpm run ci:app:config:test`
  - `pnpm run ci:app:build:test`
  - `pnpm run ci:admin:config:test`
  - `pnpm run ci:admin:build:test`
- the test deploy uses:
  - `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`

So the flow is:

1. a developer opens a PR and the PR workflow validates the app/admin build in test mode
2. once the PR is approved and merged to `master`, GitHub Actions sets `TEST_FIREBASE_*`
3. `config.firebase.cjs` generates `src/config.ts` and `src/firebase.config.ts`
4. Angular builds using the test-mode generated files and the Angular CLI `development` build profile
5. Hosting deploys to the **test Firebase project**
6. after test validation, a developer manually runs the prod release workflow with the tested `release_ref`

### Is test rolled into PR and release flow?

For **app/admin hosting**, yes.

- PR workflows validate the changes before merge
- the merged commit deploys to the **test Firebase project** first
- after test validation, a developer manually triggers the prod release workflow for the tested ref

For **production**, deployment only happens after that explicit manual release step.

### Functions test deployment

Functions now use a dedicated PR validation workflow plus a merge-time promote-after-test workflow, and they still support manual deployment.

Current test deployment paths:

- `pnpm run functions:deploy:test`
- `.github/workflows/functions-test-and-prod-release.yml`

The pull request workflow is the Functions PR validation path:

1. unit tests always run on matching PRs
2. integration tests run when the required test secrets are available

The merge-to-master workflow is the Functions test deployment path:

1. unit tests run
2. integration tests run against the test configuration
3. the workflow deploys Functions to the test Firebase project
4. after test validation, a developer manually triggers the prod release workflow for the tested ref

That command now:

1. generates `santashop-functions/.env.santas-workshop-test`
2. switches Firebase to the test project
3. deploys Functions

Important caveat:

- Functions currently read **unprefixed** runtime variable names such as `AWS_ACCESS_KEY_ID`, `SANTASHOP_PROGRAM_YEAR`, etc.
- The per-project generated env file solves that by converting the shared root config into the correct unprefixed runtime variables for the target project.

In GitHub Actions, those values are supplied through `TEST_...` secrets and converted into the generated test env file before deploy.

## Production environment

### Angular production hosting

For production app/admin deploys in GitHub Actions:

- the **production Firebase project** is used: `santas-workshop-193b5`
- the workflows inject `PROD_FIREBASE_*` values
- the production job in the merge workflow runs:
  - `pnpm run ci:app:config:prod`
  - `pnpm run ci:app:build:prod`
  - `pnpm run ci:admin:config:prod`
  - `pnpm run ci:admin:build:prod`
- production hosting uses:
  - `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

Flow:

1. the merged commit is deployed to the **test Firebase project** first
2. a developer validates the test deployment
3. a developer manually runs the prod release workflow with the tested `release_ref`
4. GitHub Actions sets `PROD_FIREBASE_*`
5. `config.firebase.cjs` generates prod `src/config.ts` and `src/firebase.config.ts`
6. Angular builds with production-mode generated config
7. Hosting deploys to the production Firebase project

### Functions production deployment

Current production Functions deployment paths:

- `pnpm run functions:deploy:prod`
- `.github/workflows/functions-test-and-prod-release.yml`

That production job now:

1. is started manually with the tested `release_ref`
2. generates `santashop-functions/.env.santas-workshop-193b5`
3. switches Firebase to the production project
4. deploys Functions

As with test, deployed Functions still consume unprefixed runtime variable names. The difference is that the project-specific generated env file now provides the correct values to Firebase CLI.

Required GitHub secrets for Functions CI/CD are:

- `TEST_AWS_ACCESS_KEY_ID`
- `TEST_AWS_SECRET_ACCESS_KEY`
- `PROD_AWS_ACCESS_KEY_ID`
- `PROD_AWS_SECRET_ACCESS_KEY`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

## Syncing secrets to Google Cloud Secret Manager

The repository includes a PowerShell helper at `scripts/gcloud-secrets.ps1`.

It:

- reads the root `.env`
- resolves `TEST_...` and `PROD_...` values where available
- falls back to unprefixed values when no prefixed override exists
- creates or updates Secret Manager secrets in the correct Google Cloud project using `gcloud`

### Projects targeted

- `test` -> `santas-workshop-test`
- `prod` -> `santas-workshop-193b5`

### Secret names synced

The script syncs the same key names used in `.env`, including:

- Angular/Firebase web config keys such as:
  - `FIREBASE_API_KEY`
  - `FIREBASE_AUTH_DOMAIN`
  - `FIREBASE_DATABASE_URL`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET`
  - `FIREBASE_MESSAGING_SENDER_ID`
  - `FIREBASE_APP_ID`
  - `FIREBASE_MEASUREMENT_ID`
- Functions keys such as:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `SANTASHOP_PROGRAM_YEAR`
  - `SANTASHOP_TIME_ZONE`
  - `SANTASHOP_TIME_OFFSET`
  - `FIRESTORE_BACKUP_BUCKET`
  - `REGISTRATION_EMAIL_TEMPLATE`
  - `REMINDER_EMAIL_TEMPLATE`
  - `SCHEDULED_FIRESTORE_BACKUP`
  - plus optional keys like `SANTASHOP_SHOP_DAYS`

### Usage

Sync both environments:

```text
pwsh ./scripts/gcloud-secrets.ps1
```

Only sync test:

```text
pwsh ./scripts/gcloud-secrets.ps1 -Environment test
```

Only sync prod:

```text
pwsh ./scripts/gcloud-secrets.ps1 -Environment prod
```

Preview changes without writing:

```text
pwsh ./scripts/gcloud-secrets.ps1 -WhatIf
```

### Requirements

- `gcloud` must be installed and on `PATH`
- you must already be authenticated with `gcloud auth login`
- your active account must have permission to create and update secrets in the target projects

### How value resolution works

For each environment:

- test prefers `TEST_<KEY>`
- prod prefers `PROD_<KEY>`
- if no prefixed override exists, the script falls back to the unprefixed `<KEY>`

That lets you keep shared values once in `.env` and only override what differs per environment.

## Syncing GitHub Actions secrets

The repository also includes `scripts/github-secrets.ps1` for the secrets consumed by the GitHub workflows.

It:

- reads the root `.env`
- resolves the exact GitHub Actions secret names expected by the workflows
- falls back to unprefixed values where appropriate
- writes the secrets with `gh secret set`

### Secrets synced

Required secrets currently include:

- `TEST_FIREBASE_API_KEY`
- `PROD_FIREBASE_API_KEY`
- `TEST_AWS_ACCESS_KEY_ID`
- `TEST_AWS_SECRET_ACCESS_KEY`
- `PROD_AWS_ACCESS_KEY_ID`
- `PROD_AWS_SECRET_ACCESS_KEY`

Optional secrets currently include:

- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

### Usage

```text
pwsh ./scripts/github-secrets.ps1
```

Preview only:

```text
pwsh ./scripts/github-secrets.ps1 -WhatIf
```

### Requirements

- `gh` must be installed and on `PATH`
- you must already be authenticated with `gh auth login`
- your account must have permission to manage repository secrets

## Variable naming conventions

### Angular client config variables

These are environment-scoped using prefixes:

- `TEST_FIREBASE_*`
- `PROD_FIREBASE_*`

The generator also supports unprefixed `FIREBASE_*` as a compatibility fallback, but the preferred contract is the prefixed one.

### Functions runtime variables

These are currently unprefixed and shared by name across environments:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SANTASHOP_PROGRAM_YEAR`
- `SANTASHOP_TIME_ZONE`
- `SANTASHOP_TIME_OFFSET`
- `SANTASHOP_SHOP_DAYS`
- `SANTASHOP_DEFAULT_MAX_SLOTS`
- `FIRESTORE_BACKUP_BUCKET`
- `SES_REGION`
- `REGISTRATION_EMAIL_TEMPLATE`
- `REMINDER_EMAIL_TEMPLATE`
- `SANTASHOP_EVENT_DISPLAY_NAME`
- `REMINDER_EMAIL_SENDING_STALE_MINUTES`
- `REGISTRATION_EMAIL_SOURCE`
- `REGISTRATION_EMAIL_RETURN_PATH`
- `SCHEDULED_FIRESTORE_BACKUP`
- `SCHEDULED_DATETIME_SLOT_COUNTERS`
- `SCHEDULED_REGISTRATION_STATS`
- `SCHEDULED_USER_STATS`
- `SCHEDULED_CHECKIN_STATS`

Optional environment-specific overrides are supported in the root `.env` by prefixing the same keys with `TEST_` or `PROD_`.

`SES_REGION` is still the primary setting. At runtime, Functions also accept `AWS_REGION` as a fallback if `SES_REGION` is not present.

Examples:

- `TEST_FIRESTORE_BACKUP_BUCKET`
- `PROD_FIRESTORE_BACKUP_BUCKET`

If an override is not present, the generator falls back to the unprefixed value.

## Safe day-to-day workflows

### Local app/admin work

Recommended commands:

```text
pnpm run config:app:dev
pnpm run config:admin:dev
pnpm --filter @santashop/app start
pnpm --filter @santashop/admin start
```

### Local test-style app/admin build

```text
pnpm run config:app:test
pnpm run config:admin:test
pnpm --filter @santashop/app build:test
pnpm --filter @santashop/admin build:test
```

### Local Functions work

```text
pnpm run config:functions:test
pnpm run emulators:start
pnpm run functions:test:unit
pnpm run functions:test:integration
```

### PR validation and test promotion

1. push a branch / open PR
2. GitHub Actions validates app/admin builds and Functions tests on the PR
3. once the PR is approved, merge it to `master`
4. the merge workflow deploys the merged commit to the test Firebase project
5. validate behavior in the test environment

### Production release

1. finish testing the merged commit in the test environment
2. run the matching manual production workflow and provide the tested `release_ref`
3. GitHub Actions deploys app, admin, or Functions to the production Firebase project

## Do and don't

### Do

- keep `.env.example` as the documentation source of truth
- keep real local values in `.env`
- treat `src/config.ts` and `src/firebase.config.ts` as generated output
- treat `santashop-functions/.env.<project>` as generated output
- rotate true secrets in the secret store, not by editing generated files
- use the merged test deployment against the test Firebase project before approving prod release
- record the tested commit SHA so the same `release_ref` is promoted to production

### Don't

- do not edit `src/config.ts` by hand
- do not edit `src/firebase.config.ts` by hand
- do not edit `santashop-functions/.env.santas-workshop-test` or `.env.santas-workshop-193b5` by hand
- do not assume Firebase web API keys are private once shipped to the browser
- do not put real secret values into committed docs
- do not assume generated Functions env files should be committed

## Current limitations and future cleanup

1. Functions still consume **unprefixed runtime variable names** at runtime even though generation now supports `TEST_` / `PROD_` overrides.
2. `santashop-functions/.env` is still supported as a fallback even though the root `.env` is now preferred.
3. App/admin promotion is commit-based rather than identical-artifact promotion because each environment intentionally generates different Firebase client config.

## Troubleshooting

### `src/firebase.config.ts` has the wrong project

Run the correct generator command explicitly:

```text
pnpm run config:app:dev
pnpm run config:admin:dev
pnpm run config:app:test
pnpm run config:admin:test
pnpm run config:app:prod
pnpm run config:admin:prod
```

### `src/config.ts` has the wrong production flag or label

Regenerate using the correct mode:

- `dev` for local development
- `test` for QA / preview / test hosting
- `prod` for production

### A build says a Firebase variable is missing

Check that `.env` contains the required `TEST_FIREBASE_*` or `PROD_FIREBASE_*` values, or that GitHub Actions has the matching workflow secret set.

### Functions fail with `Missing required environment variable`

Check:

- root `.env`
- generated `santashop-functions/.env.<project>` file for the project you are targeting
- optional `santashop-functions/.env`
- any shell-exported environment variables

Remember that `runtime-config.ts` does not overwrite values that are already present in the process environment.

### GitHub workflow editor warns about invalid secret names

That usually means the referenced secret has not been created yet in GitHub. The workflow file can still be correct; the secret just needs to exist in the repository or environment settings.
