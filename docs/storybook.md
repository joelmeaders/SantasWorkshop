# Isolated UI development with Storybook

Storybook contains the registration and admin components and pages. Each story renders the production Angular component with local fixture data. Stories do not need Firebase credentials, emulators, a signed-in account, email services, or a camera.

## Start the catalog

Use Node and pnpm versions from the workspace README. From the workspace root:

```sh
pnpm install
pnpm run storybook
```

Use the Registration and Admin groups to find a page or component. Choose a named state in the sidebar. Controls expose supported inputs. The Docs tab explains the state, component inputs, and mock boundaries. The accessibility panel reports automated checks for the current story.

## Validate changes

Install the test browser once with `pnpm exec playwright install chromium`. Linux CI uses `pnpm exec playwright install --with-deps chromium`.

```sh
pnpm run storybook:typecheck
pnpm run storybook:lint
pnpm run storybook:coverage
pnpm run storybook:build
pnpm run storybook:test
```

Use `pnpm run ci:storybook` to run the complete type, lint, inventory, build,
interaction, and accessibility gate. The normal `ci:app:test` and
`ci:admin:test` commands include this gate. Their pull-request and release
workflows therefore test Storybook with the other customer and admin tests.
The separate Storybook pull-request workflow runs the Windows visual suite.

The inventory check finds Angular `@Component` declarations in both apps. It requires a colocated TypeScript story that directly imports and references each component. Every named story must define or inherit a local play function. See the [generated inventory](storybook-inventory.md) for source links and named states.

The browser tests render stories and execute their play functions. Accessibility violations fail the run. Automated accessibility checks cover machine-detectable issues. Also review keyboard navigation, focus order, zoom, and screen-reader announcements when changing interactive UI.

These are isolated UI tests. Existing unit tests still cover service logic. Emulator E2E tests still cover integration with Firebase. Storybook does not verify deployed services or production workflows.

## Preparing for a signals migration

The catalog is a regression baseline, not proof that a signals conversion preserves every behavior. Component coverage counts show which components have stories. They do not measure branch coverage or reactive behavior coverage.

Keep three kinds of evidence during each conversion:

| Check                                          | Regression it can detect                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Interaction and transition stories             | Stale rendered state after new data, incorrect derived state, broken controls, or wrong submitted values     |
| Visual comparisons at mobile and desktop sizes | Missing content, spacing, wrapping, clipping, and changed layout                                             |
| Focused unit and integration tests             | Subscription cleanup, cancellation, error propagation, request ordering, route guards, and backend contracts |

Large serialized DOM snapshots are not the default. They produce noisy changes when Angular or Ionic changes internal markup. Prefer visible behavior assertions and image comparisons. See [Storybook's snapshot guidance](https://storybook.js.org/docs/writing-tests/snapshot-testing).

Before converting a component:

1. Run its existing tests and inspect its stories before changing production code.
2. Identify each data source, initial value, derived value, input, output, and side effect.
3. Add a transition story for any important behavior that is not represented. Emit new fixture data after the first render and assert the resulting UI. Do not force change detection to hide a stale view.
4. Include absent data, populated data, and replacement data where the component supports them. Test permission changes and disabled controls where relevant.
5. Keep public behavior assertions while changing the implementation. Adapt mock interfaces only when the production interface changes.
6. Run the component tests, the full Storybook suite, and visual comparisons. Review image differences before accepting a new baseline.
7. Run the relevant emulator E2E journeys when a change crosses routing, authentication, or service boundaries.

For `toSignal`, explicitly decide what the UI shows before the first emission. Use `requireSync` only for sources that guarantee a synchronous emission. Check equality behavior and destruction cleanup in focused tests when those contracts change. Angular documents these constraints in [RxJS interop](https://angular.dev/ecosystem/rxjs-interop).

Signals-first UI does not require removing RxJS from asynchronous service workflows. Preserve cancellation, debouncing, retries, and ordering until equivalent behavior has test evidence. Do not use this migration to change appointment capacity or annual data policies.

## Visual regression checks

Build the current source before comparing images:

```sh
pnpm run storybook:build
pnpm run storybook:visual
```

The visual suite reads every named story from the static Storybook index. It compares desktop and mobile screenshots after the story's play function and render audit pass. Use `pnpm run storybook:visual:report` to inspect local failures.

Update images only after inspecting and accepting an intentional visual change:

```sh
pnpm run storybook:visual:update
```

The comparison command must fail for a missing or changed baseline. PR validation never approves or commits baseline changes automatically. On failure, it uploads differences and separately renders candidate references for review; the job remains failed. Keep accepted baseline changes in the same review as the intentional UI change, and inspect the differences rather than accepting every generated image.

Images are stored by rendering environment and viewport. Local Windows references use `win32`; the hosted Windows Server 2022 job uses `windows-2022`, selected with `STORYBOOK_SNAPSHOT_PLATFORM`. Their font rendering differs, so they need separate reviewed references. Functional and accessibility validation runs on Linux. Do not copy reference images between environments. Playwright explains [why rendering environments affect screenshots](https://playwright.dev/docs/test-snapshots).

Screenshots capture each story's final visible viewport. They do not prove every intermediate state, offscreen element, keyboard action, or browser is correct. Preserve transition assertions and the existing integration suite alongside visual checks.

The initial `windows-2022` references were captured by [CI run 34073445330](https://github.com/joelmeaders/SantasWorkshop/actions/runs/34073445330) from commit `5b953a7`. All 166 captures passed their story and resource audits. The complete contact sheets and representative full-size images were reviewed before the references were committed.

Initial local validation passed on Windows: 52 component/page suites, 83 story tests, and 166 desktop/mobile image comparisons. The build, typecheck, lint, and inventory checks also passed. Deliberately withheld fixture updates and a deliberate image mutation caused the expected failures. Customer and admin stories also passed a revisit check in the same browser context. These results establish a regression baseline; they do not certify all future conversions or remove existing UI defects.

## Add a component or page

1. Add a colocated `*.stories.ts` file beside the production component.
2. Import the actual component and set `component` in its default story metadata.
3. Add `autodocs` and a description of the UI and mocked dependencies.
4. Supply all required inputs with synthetic, stable fixtures.
5. Replace external services with explicit Angular providers.
6. Add named stories for relevant populated, empty, loading, validation, error, and permission states.
7. Add play assertions for visible output and meaningful interactions.
8. Run the inventory, build, and browser checks.
9. Refresh the inventory with `node scripts/check-storybook-coverage.mjs --write`.

Use the existing stories and app-specific helpers in `.storybook/registration` and `.storybook/admin` as examples. Keep each mock limited to the interface the UI uses. An unsupported external operation should fail clearly, rather than silently return generic data.

## Mock boundaries

- Create mutable mocks for each story render. Do not share subjects, form state, or call history across stories.
- Model observable state with local RxJS values. Model service writes with local results and assert calls when testing submission.
- Keep real templates, pipes, forms, and child components. Do not create a second copy of the page markup.
- Use local assets and synthetic account, child, appointment, and report data.
- Keep router navigation inside the story environment. Do not import the application bootstrap or production route guards.
- Represent scanner states without requesting camera access. Represent email and owner operations without calling a backend.
- Do not bypass accessibility rules to make a test pass. Fix the UI or document a precise test limitation with evidence.

## Framework

The integration uses Storybook 10.6 with Angular's Vite framework and the docs, accessibility, and Vitest addons. The Angular Vite framework is currently a Storybook preview feature. Its supported Angular range includes this workspace's Angular 22 release. Keep Storybook packages on the same catalog version when upgrading.

References: [Angular with Vite](https://storybook.js.org/docs/get-started/frameworks/angular-vite), [interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing), and [accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing).
