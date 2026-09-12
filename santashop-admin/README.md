# Admin app

The staff app uses standalone Angular and Ionic components. Keep routes, guards,
operational flags, and Firebase contracts independent of display preferences.

## Navigation and layout

On phones, the shell provides Home, Check-In, and Search. Home provides access to
the other workflows, based on staff permissions. The session shell displays the
sidebar at 1024px and above. Existing search URLs still work; the main search
screen embeds the same forms and retains their values when switching methods.

Use `HeaderComponent` for page headings, back navigation, and device preferences.
Use the admin theme variables in `src/theme/variables.scss` for surfaces, text,
borders, and actions. Global controls have a minimum 44px action height and
visible keyboard focus. Keep wide tables inside their own scroll region.

The camera starts only after staff request it. Changing language or appearance
must not restart the camera or replace a form, editor, or active dialog.

## Language and appearance

`provideAdminLanguage()` configures the admin translation loader and overlay
controllers. Register it after `provideIonicAngular()` so the translated alert
and loading controllers take precedence. Tests that mock Ionic controllers can
keep their existing providers.

The app stores `santashop-admin-language` (`en` or `es`) and
`santashop-admin-theme` (`system`, `light`, or `dark`) on the current device.
English and System are the defaults. Storage failures do not prevent session
preferences from working. The small script in `src/index.html` applies the saved
appearance before Angular starts; keep it consistent with `AdminThemeService`.

English source phrases are translation keys. Add each phrase and its Spanish
translation to the separate admin dictionaries in `src/assets/i18n`. Keep the
same interpolation parameters in both dictionaries. Use `adminText` for visible
copy and `AdminLanguageService.text()` for TypeScript copy. Missing keys remain
readable in English. Do not translate stored identifiers, user-entered names,
confirmation phrases, or email-template content.

Use `createAdminAlert(controller, () => options)` when dialog text depends on
current state. The factory lets open dialogs update without dismissing them.
Keep reactive status messages derived from their original source copy, so a
language change can update an already visible result.

Use `adminDate` and `adminTimeSlot` for event times in America/Denver.
Use `adminCalendarDate` for birthdays, which are calendar dates without a time
zone. Use `adminNumber` for formatted numeric values. Staff language is separate
from customer language and from the language of an email template.

Report display formatting belongs in the UI. `ReportTableComponent` accepts
optional display rows and column formats while CSV downloads use the original
rows, columns, and metadata. Preserve a real zero and an unavailable historical
calculation as distinct values.

## Checks

Run these commands from the workspace root:

```text
pnpm --filter @santashop/admin lint
pnpm --filter @santashop/admin test
pnpm --filter @santashop/admin verify:bundle
pnpm run ci:storybook
pnpm run storybook:visual
pnpm run e2e:test:admin
```

The home, scanner, search-results, and registration-report stories include both
languages and both explicit themes. Review phone, tablet, and desktop layouts
when changing shared controls. Read `docs/browser-flow-testing.md` and the
repository E2E skill before running browser journeys. Keep release evidence in
the project Obsidian archive as required by `docs/README.md`.
