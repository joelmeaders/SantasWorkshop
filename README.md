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

- **Node.js 24.x**: Managed via two complementary approaches:
  - [mise](https://mise.jdx.dev/) - For general shell usage (version pinned in `mise.toml`)
  - pnpm's `devEngines.runtime` - Auto-downloads correct Node.js for pnpm scripts (version in lockfile)
- **pnpm**: v10.14 or later (required for `devEngines.runtime` feature)

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

### Deploy Functions

```bash
# Test environment
pnpm run functions:deploy:test

# Production
pnpm run functions:deploy:prod
```
