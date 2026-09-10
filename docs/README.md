# Project documentation

Keep maintained project guidance here. Each page describes a contract, design,
procedure, requirement, or source inventory that remains useful until the
implementation or policy changes.

## Start here

| Topic | Maintained reference |
| --- | --- |
| Workspace setup and commands | [Root README](../README.md) |
| Contributor rules | [AGENTS.md](../AGENTS.md) |
| Customer architecture | [Customer app](app/ARCHITECTURE_OVERVIEW.md) |
| Admin architecture and reads | [Admin app](admin/ARCHITECTURE_OVERVIEW.md), [data freshness](admin/DATA_FRESHNESS.md) |
| Backend handlers and runtime paths | [Functions reference](functions-reference.md), [function call map](function-call-map.md) |
| Business and acceptance contracts | [Business](requirements/BUSINESS_REQUIREMENTS.md), [functional](requirements/FUNCTIONAL_REQUIREMENTS.md), [non-functional](requirements/NON_FUNCTIONAL_REQUIREMENTS.md) requirements |
| Configuration and credentials | [Configuration](SECRETS_AND_CONFIGURATION.md), [Remote Config](remote-config.md) |
| Email authoring and review | [Bilingual templates](email-templates.md) |
| Test coverage and acceptance | [Test coverage](test-coverage.md), [integrated suite](testing/integrated-test-suite.md) |
| Browser test procedure | [Browser flows](browser-flow-testing.md), [emulator E2E](testing/e2e.md) |
| UI development and visual tests | [Storybook](storybook.md), [generated inventory](storybook-inventory.md) |
| Deployment and operations | [Release procedure](release-readiness.md), [yearly startup](yearly-startup.md) |
| Load and resource validation | [Load harness](load-acceptance.md), [resource sizing](function-resource-sizing.md) |
| Browser updates and caching | [Service worker](service-worker-caching.md) |

## Where records belong

Release notes other than changelogs, dated test results, audits, agent handoffs,
PR drafts, deployment evidence, meeting notes, and one-time migration snapshots
belong in the Denver Santa Claus Shop project in the owner's Obsidian vault.
The existing vault folder is named **Denver Santas Claus Shop**. Open its
[project home](obsidian://open?vault=Joel%27s%20Obsidian%20Vault&file=Denver%20Santas%20Claus%20Shop%2FProject%20Home)
to find release, QA, load, configuration, and OneNote records.

Keep repository and package `CHANGELOG.md` files in Git. Also keep application
assets, fixtures, visual test baselines, generated source inventories, and
configuration that the application or tooling consumes. A year in an email
starter's asset path does not make it a release log.

When a page mixes a procedure with a result, preserve its dated version in the
vault and keep the maintained procedure here. Link to the procedure from other
repository pages. Historical references in changelogs may retain their original
paths; Git history and the vault's source-path inventory preserve those records.

## Recording future work

Create authored records directly under this existing project path:

```text
C:\Users\joelm\OneDrive\Documents\Notes\Joel's Obsidian Vault\Denver Santas Claus Shop\Archive
```

Use the topic folders `Releases`, `QA`, `Load and Resources`, `Remote Config`,
`Email`, or `Website`; add another topic when needed. Name a new note
`YYYY-MM-DD <subject>.md`, using the work's date in America/Denver. Include a
run ID or revision when needed to distinguish multiple records on the same day.
Add a link to the note in the vault's `Archive Index.md`.

For each dated record, include its source revision, environment, date, result,
limits, and relevant evidence. Keep actual deployment results separate from
source inspection, local tests, and emulator checks. Preserve original records
when adding a later correction; mark superseded instructions clearly.

Do not create authored reports in the repository, including ignored folders,
or disguise a point-in-time report with an undated name. Keep maintained
procedures free of run histories and completion logs. Changelogs remain in Git.

Tools may write generated artifacts such as Playwright output, screenshots,
load journals, and resource JSON to their existing ignored output folders.
Write the narrative report in the vault and link selected evidence. At handoff,
copy selected artifacts to `Sources` in the vault, record their original paths,
and verify their hashes before any authorized removal of local copies. Preserve
earlier evidence when recording a correction or later result.

If the vault is unavailable, keep working and disclose the missing archive step.
Use an OS temporary directory outside the repository if the report must be saved;
report its path and migrate it when the vault becomes available. Do not silently
fall back to repository documentation or claim the archive is complete.

Keep secrets and credentials out of notes. Do not
copy dependency caches, generated build trees, or unrelated personal notes into
the project archive.

Update maintained docs with code changes. Store acceptance results in the vault,
not as dated files or appended execution logs in this directory.
