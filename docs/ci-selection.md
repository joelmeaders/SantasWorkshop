# CI target selection

The PR and release workflows use `ci-changes.yml` and `scripts/ci-changes.mjs`.
Each workflow starts a selection job. Unselected test and deployment jobs are
skipped. The selection job reports the changed files and selected work in its
GitHub Actions summary.

PR selection compares the head with its merge base. Push selection compares the
previous and current commit. Renames select both the old and new consumers.
A failed Git comparison fails selection and blocks deployment.

| Change                                           | PR validation                                                                      | Automatic TEST deployment            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------ |
| Customer app source or assets                    | App unit/build, app E2E, app Storybook                                             | App Hosting                          |
| Admin source or assets                           | Admin unit/build, admin E2E, admin Storybook                                       | Admin Hosting                        |
| App or admin unit test                           | That application's unit/build job                                                  | None                                 |
| App or admin E2E test                            | That application's E2E suite                                                       | None                                 |
| App or admin story or snapshot                   | That application's Storybook checks                                                | None                                 |
| Shared browser fixture or emulator configuration | Both E2E suites                                                                    | None                                 |
| Shared Angular core runtime                      | Core tests, both UI jobs, both E2E suites, both Storybook targets                  | Both Hosting targets                 |
| Shared models runtime                            | Core tests, both UI jobs, Functions tests, both E2E suites, both Storybook targets | Both Hosting targets and Functions   |
| Functions runtime or build input                 | Functions unit/integration, both consuming E2E suites                              | Functions                            |
| Functions test input                             | Functions unit/integration                                                         | None                                 |
| Firebase rules or indexes                        | Functions integration coverage and both E2E suites                                 | Rules and indexes, without Functions |
| CI selection or release policy                   | Workflow and release contract tests                                                | None                                 |
| Maintained README, changelog, or documentation   | Selection and final status only                                                    | None                                 |

A backend change can affect both applications, so it validates both browser
journeys. It does not publish unchanged Hosting bundles. E2E jobs build local
Functions to run the emulators. That build is not a cloud deployment.

Shared JSON and YAML files receive content comparison. Root scripts select their
named consumer. Angular project changes select the changed project. Firebase
Hosting configuration selects its site. Lockfile changes follow each importer's
resolved dependency graph, including transitive dependencies and integrity data.
Named dependency catalogs select the packages that consume them. Root release
metadata does not trigger a deployment. App package versions do affect their
built configuration and therefore select that application.

Unknown shared executable inputs, unsupported dependency formats, and malformed
configuration select all consumers conservatively. Add an explicit rule and a
regression test when introducing a new input with narrower ownership.

Storybook uses `STORYBOOK_TARGETS=app` or `STORYBOOK_TARGETS=admin`. Each matrix job
runs the selected stories, lint, typecheck, behavior tests, and visual comparisons.
Existing snapshot names and paths stay the same. Local commands without this
variable include both applications.

A manual TEST release still validates and deploys the requested target. A manual
production release keeps the exact-SHA checks in [release readiness](release-readiness.md).
UI promotion requires its own UI and Storybook evidence. Missing evidence can be
created through a manual TEST or Storybook run for that exact commit. Skipped
jobs never count as successful test or deployment evidence.

Run the selection and workflow regression checks from the root:

```sh
node --test scripts/ci-*.test.mjs scripts/ui-targets.test.mjs scripts/release-*.test.mjs scripts/storybook-targets.test.mjs
```

The suite evaluates the real workflow job conditions with successful, failed,
cancelled, and deliberately skipped results. Deployment tests use injected local
command recorders and do not call Firebase.
