# Yearly startup

The yearly startup is split between deploy-time configuration and owner-only
runtime operations. Never run the reset against production until the test
project workflow has passed.

## 1. Configure and validate the new year

Set `SANTASHOP_PROGRAM_YEAR` (or the matching `TEST_` and `PROD_` values) in the
root environment configuration. Update shop days and the time offset when the
calendar requires it. The app/admin configuration and Functions runtime now
read the same year source; schedule dates are generated in the owner UI instead
of being hardcoded in a Pub/Sub handler.

Run the configuration generators, dependency updates, scoped tests, and
production builds before deployment:

```powershell
pnpm run config:functions:test
pnpm run config:admin:test
pnpm --filter @santashop/functions lint
pnpm --filter @santashop/functions test:unit
pnpm --filter @santashop/functions build
pnpm --filter @santashop/admin lint
pnpm --filter @santashop/admin test
pnpm run ci:admin:build:prod
```

Deploy Functions before the owner UI so every visible action has a live
server-authoritative endpoint.

## 2. Run the owner workflow

In **Admin > Owner Operations**:

1. Create and download a marketing email export. The reset refuses to preview
   unless a successful private export from the last seven days still exists.
2. Preview the yearly reset. Verify the Auth, Firestore, schedule, queue, and QR
   counts.
3. Reauthenticate and enter the exact project/year confirmation phrase.
4. Start the reset. It starts a new full Firestore export and polls it through
   resumable private tasks. No deletion starts if that export fails.
5. Watch the recorded stages and counts to completion. Retrying the task skips
   purge stages already recorded as complete.

The reset deletes all nonstaff Auth users, including disabled customers;
customer/registration/check-in/queue collections; registration QR images; and
old `dateTimeSlots`. It retains staff and owner accounts, parameters, stats,
email templates, private exports, and owner audit/job records.

After reset completion, use **Schedule & Capacity Editor** as an owner to
generate and validate the new year's schedules. Ordinary administrators may
continue editing schedules but cannot initialize them.

## 3. Archive and deploy

The reset result displays the exact `gs://` Firestore backup location. After
authenticating the Google Cloud CLI, copy it to an existing local archive
directory:

```powershell
gcloud components update
gcloud auth login

pnpm --filter @santashop/functions owner:archive-backup -- `
  --project santas-workshop-193b5 `
  --confirm-project santas-workshop-193b5 `
  --backup gs://santashop-backups/yearly-reset/2025/operation-id `
  --destination Z:\DSCS
```

Cloud Firestore exports do not restore Auth passwords or deleted QR objects.
Finish by building/deploying to the test project, validating owner operations
and generated schedules, and only then deploying the production app/admin.
