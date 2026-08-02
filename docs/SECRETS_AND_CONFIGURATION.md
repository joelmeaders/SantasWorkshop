# Secrets and Configuration Guide

This repository has separate configuration paths for browser applications and
Firebase Functions. GitHub Actions is the deployment source of truth.

## Configuration model

### Browser configuration

The Angular app and admin site receive Firebase web configuration at build
time. These values are shipped to browsers and must not be treated as
cryptographic secrets:

- `*_FIREBASE_API_KEY`
- `*_FIREBASE_AUTH_DOMAIN`
- `*_FIREBASE_DATABASE_URL`
- `*_FIREBASE_PROJECT_ID`
- `*_FIREBASE_STORAGE_BUCKET`
- `*_FIREBASE_MESSAGING_SENDER_ID`
- `*_FIREBASE_APP_ID`
- `*_FIREBASE_MEASUREMENT_ID`

The client generators use `TEST_FIREBASE_*` for development, test, and QA,
and `PROD_FIREBASE_*` for production. They generate each application's
`src/config.ts` and `src/firebase.config.ts` before the Angular build. Security
still comes from Firebase Auth, App Check, Firestore/Storage rules, and project
separation rather than secrecy of the web configuration.

### Functions runtime configuration

Firebase Functions read unprefixed values from `process.env`. The root
`config.functions.cjs` generator resolves `TEST_<KEY>` or `PROD_<KEY>` values
and writes an ignored, project-specific file:

- test: `santashop-functions/.env.santas-workshop-test`
- production: `santashop-functions/.env.santas-workshop-193b5`
- local emulator: `santashop-functions/.env.demo-santashop`

Firebase CLI loads the selected file during deployment and persists the values
as ordinary Function revision environment variables. Privileged GCP users who
can inspect Function revisions may also be able to inspect the AWS credentials.
Never print generated dotenv contents or credentials in workflow logs.

## GitHub repository secrets

The complete required repository-secret inventory is:

- `TEST_FIREBASE_API_KEY`
- `PROD_FIREBASE_API_KEY`
- `TEST_AWS_ACCESS_KEY_ID`
- `TEST_AWS_SECRET_ACCESS_KEY`
- `PROD_AWS_ACCESS_KEY_ID`
- `PROD_AWS_SECRET_ACCESS_KEY`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

All other Firebase client and Functions settings are non-sensitive configuration
kept in the workflow files. Do not recreate the obsolete repository secrets
`FIREBASE_API_KEY`, `TEST_ADMIN_BOOTSTRAP_PASSWORD`, or
`PROD_ADMIN_BOOTSTRAP_PASSWORD`.

### Synchronize repository secrets

Copy `.env.example` to the ignored root `.env`, fill all eight secret values,
and run:

```text
pwsh ./scripts/github-secrets.ps1
```

Preview the target secret names without writing:

```text
pwsh ./scripts/github-secrets.ps1 -WhatIf
```

The helper requires an authenticated GitHub CLI and repository permission to
manage Actions secrets. Service-account JSON must be represented on one line in
the dotenv file.

## Local development

The root `.env` is a developer-local input and must remain ignored. It is not a
deployment source.

Generate app or admin configuration as needed:

```text
pnpm run config:app:dev
pnpm run config:admin:dev
pnpm run config:app:test
pnpm run config:admin:test
```

Local/emulator Functions workflows generate their own ignored environment file
through the existing root scripts. Emulator email delivery remains off by
default, so normal unit, integration, and E2E runs do not require or use live
AWS credentials. Set `SANTASHOP_SEND_EMAILS_FROM_EMULATOR=true` only for an
intentional SES integration run, and supply local `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` values for that run.

Do not use local production configuration to deploy. Production generation is
reserved for the release workflow.

## GitHub Actions deployment flow

### Pull requests

- App/admin workflows validate test-mode builds without deploying.
- Functions unit tests always run.
- Functions integration tests run only when the test AWS secrets are available;
  forked PRs without repository-secret access report an explicit skip.

### Test deployment

A matching merge to `master` runs the Functions release workflow. The deploy
job:

1. receives test AWS credentials and the test Firebase service account from
   repository secrets
2. validates that every required value is present
3. writes the service-account JSON into the ephemeral runner directory
4. runs integration tests
5. generates `.env.santas-workshop-test`
6. deploys Functions to `santas-workshop-test`

### Production deployment

After validating test, manually dispatch the same workflow with the tested
commit SHA or ref as `release_ref`. The production job checks out that ref,
generates `.env.santas-workshop-193b5`, and deploys it to
`santas-workshop-193b5`.

### GitHub-only enforcement

`firebase.json` runs `scripts/assert-functions-deploy-ci.cjs` before every
Functions deployment. The guard requires both:

- `GITHUB_ACTIONS=true`
- `SANTASHOP_FUNCTIONS_DEPLOY=test` or `prod`

The release workflow supplies the target marker. A direct local
`firebase deploy --only functions` fails before lint, build, or cloud changes.
Firestore rules and Hosting deployment behavior are unchanged.

## Credential rotation

Rotate one environment at a time:

1. create the replacement AWS key or Firebase service-account credential
2. update the matching GitHub repository secret without logging its value
3. run the test deployment and exercise registration email delivery, test-email
   sending, and SES template publishing
4. promote the tested ref to production when applicable
5. revoke the old credential only after the deployed Function revision passes
   its smoke checks

Changing a GitHub secret does not update an already deployed Function. A new
Functions deployment is always required.

## Deployment storage invariant

The repository does not provision or synchronize provider-managed credential
resources. `scripts/github-secrets.ps1` writes only GitHub Actions repository
secrets, and the Functions workflows pass generated values to the Firebase CLI
as ordinary revision environment variables. Keep generated dotenv files
ignored, never log their contents, and use GitHub Actions for every Functions
deployment.

## Troubleshooting

### A generator reports a missing value

For app/admin, confirm the matching `TEST_FIREBASE_*` or `PROD_FIREBASE_*`
inputs. For Functions, confirm every required `TEST_*` or `PROD_*` workflow
value exists. The generator fails closed rather than producing a partial file.

### A Functions deploy is rejected locally

This is expected. Merge the change for a test deployment, then promote the
tested ref with the manual production workflow.

### GitHub cannot find a service-account secret

Confirm both `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST` and
`FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5` exist as repository secrets.
The synchronization helper treats both as required.

### An emulator attempts to access AWS

Unset `SANTASHOP_SEND_EMAILS_FROM_EMULATOR`. Normal emulator runs preserve the
queued-email records but intentionally skip external SES delivery.
