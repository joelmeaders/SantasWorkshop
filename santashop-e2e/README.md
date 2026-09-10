# SantaShop E2E Tests

Playwright tests for the customer and staff applications.

The [E2E guide](../docs/testing/e2e.md) owns setup, commands, configuration, and fixture APIs:

- [Runtime, setup, and alternate emulator ports](../docs/testing/e2e.md#runtime-and-configuration)
- [Automated suites and CI orchestration](../docs/testing/e2e.md#automated-suites)
- [Manual sessions and individual specs](../docs/testing/e2e.md#manual-debugging-and-individual-specs)
- [Interactive debugging and code generation](../docs/testing/e2e.md#interactive-debugging)
- [Reports and evidence](../docs/testing/e2e.md#reports-and-evidence)
- [Writing tests and using fixtures](../docs/testing/e2e.md#fixtures-and-supported-user-flows)
- [Browser scope and reliable assertions](../docs/testing/e2e.md#reliable-browser-assertions)

Read the [browser QA guide](../docs/browser-flow-testing.md) for deployed/manual
QA and data safety. The [integrated suite](../docs/testing/integrated-test-suite.md)
retains acceptance requirements and obligations that are not automated.

E2E helpers delete emulator fixtures. Verify the emulator target before using
them; never point this suite at a deployed site. Customer and admin suites share
emulator state and must run sequentially.

## Package structure

- [tests/](tests/) — customer and staff feature specs
- [fixtures/](fixtures/) — custom fixtures and test utilities
- [playwright.config.ts](playwright.config.ts) — browser and reporting configuration
