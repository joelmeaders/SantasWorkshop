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
`config.functions.cjs` generator requires `LOCAL_<KEY>`, `TEST_<KEY>`, or `PROD_<KEY>` values for the selected target
and writes an ignored, project-specific file:

- test: `santashop-functions/.env.santas-workshop-test`
- production: `santashop-functions/.env.santas-workshop-193b5`
- local emulator: `santashop-functions/.env.demo-santashop`

Firebase CLI loads the selected file during deployment and persists the values
as ordinary Function revision environment variables. Both deployed environments
ordinarily use SES and their own scoped AWS credentials; the test load-isolation
configuration is an explicit, separate operation, not the default. Privileged
GCP users who can inspect Function revisions may also be able to inspect their
AWS credentials.
Never print generated dotenv contents or credentials in workflow logs.

The disposable Functions deploy artifact includes only the generated file for
the selected project. It never includes `santashop-functions/.env` or the root
developer-local `.env`; neither local file is required on a GitHub runner.

## GitHub repository secrets

The `scripts/github-secrets.ps1` synchronization helper requires these eight
secret names, including separate AWS credentials for both deployed environments:

- `TEST_FIREBASE_API_KEY`
- `PROD_FIREBASE_API_KEY`
- `TEST_AWS_ACCESS_KEY_ID`
- `TEST_AWS_SECRET_ACCESS_KEY`
- `PROD_AWS_ACCESS_KEY_ID`
- `PROD_AWS_SECRET_ACCESS_KEY`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST`
- `FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5`

All other Firebase client and Functions settings are non-sensitive configuration
kept in the workflow files.

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
the dotenv file. Every key must be explicitly scoped: an unprefixed AWS value
never substitutes for a missing test or production key. The helper validates all
eight inputs before any write, selects the repository explicitly, passes values
on standard input, and reports names rather than secret-bearing command lines.
It does not create cloud credentials or delete existing secrets.

The fixture test `pwsh ./scripts/github-secrets.test.ps1` shadows `gh` and checks
success, missing scoped values, `-WhatIf`, and failure redaction without network
writes. It is part of shared UI PR validation.

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
Also set `_testConfig/emailSending.enabled=true` in the verified Firestore
emulator for an intentional email integration run. Ordinary emulator runs
remain unable to send email through the application sender paths.

## Remote email sending control

The independent Firebase Remote Config parameter
**`santashop_email_sending_enabled`** must have type **BOOLEAN**, an explicit
default value, and no conditions. Set it to `false` to disable all application
email sending: registration confirmations, reminders, cancellations,
password-reset messages, and admin test emails. Set it to `true` to allow
ordinary delivery. Template authoring and publishing remain available.

Each sender caches the value for at most three minutes, measured from the
start of its read. The next send after expiry waits for a recheck. Missing,
malformed, conditional, timed-out, or unreadable settings block sending;
expired permission is never reused. A failed read also waits three minutes
before retrying to limit Remote Config traffic. A message already submitted
to AWS cannot be recalled.

You can edit the boolean in Firebase Console → Remote Config, or use these
authenticated commands with the explicit target project:

```text
node scripts/email-sending.cjs read --project santas-workshop-test
node scripts/email-sending.cjs disable --project santas-workshop-test
node scripts/email-sending.cjs enable --project santas-workshop-test
```

The commands use the same Application Default Credentials or
`REMOTE_CONFIG_ACCESS_TOKEN` authentication as the other Remote Config tools.
Updates preserve unrelated parameters and use an exact ETag; a conflict must
be reviewed before retrying. Deployment checks require the parameter to exist
but do not force it on. Initialize it explicitly in each project before the
first deployment of this control; routine deployments preserve the operator's
choice. Runtime sender identities need `cloudconfig.configs.get` (for example,
`roles/cloudconfig.viewer`), in addition to their existing application access.

Queued messages blocked by the setting become terminal `suppressed` records,
with no SES acceptance or successful-send claim. Re-enabling does not replay
them. Password-reset responses retain the generic acknowledgement to protect
account privacy; admin test sends return a clear disabled error. This control
does not hold mail for later delivery. Use a new request or an explicit admin
resend after re-enabling if a message is still needed.

Normal test and production deployments use SES. The optional load-test sink
and network are documented in [the load directory](../scripts/load/README.md).
The three-minute setting is an application control, not the independent AWS
network denial required for load testing.

Password-reset delivery also requires
`SANTASHOP_PASSWORD_RESET_CONTINUE_URL`. Use these values:

- Local: `http://localhost:4100/?mode=sign-in`
- Test: `https://test.denversantaclausshop.org/?mode=sign-in`
- Production: `https://register.denversantaclausshop.org/?mode=sign-in`

Deploy `firestore.indexes.json` with Functions so Firestore TTL can remove old
`passwordResetRateLimits` claims by their `expiresAt` field.

Do not use local production configuration to deploy. Production generation is
reserved for the release workflow.

## GitHub Actions deployment flow

### Pull requests

- App/admin workflows validate test-mode builds without deploying.
- Functions unit tests always run.
- Functions integration and browser tests use Firebase emulators and do not
  require test AWS secrets. Integration uses the generated test configuration
  with dummy AWS credentials; browser suites use the demo project and local
  dummy credentials.

### Test deployment

A matching merge to `master` runs the Functions release workflow. The deploy
job:

1. receives the test Firebase service account and scoped test AWS credentials from repository secrets
2. validates that every required value is present
3. writes the service-account JSON into the ephemeral runner directory
4. runs integration tests
5. generates `.env.santas-workshop-test` with sink transport, network isolation,
   and no AWS credentials
6. deploys Functions to `santas-workshop-test`

### Production deployment

After validating test, manually dispatch the same workflow with
`deployment_target=prod` and the tested commit SHA or ref as `release_ref`. The production job checks out that ref,
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
3. run the test deployment and verify simulated email receipts and local template
   publication; test sink mode cannot validate a live AWS credential
4. promote the tested ref to production when applicable and perform the
   separately authorized live credential/delivery check
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
queued-email records but intentionally skip external SES delivery. Hosted load
requires the independent network-denial checks in [load acceptance](../scripts/load/acceptance.md).
