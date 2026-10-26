# Bilingual email templates

The admin app provides bilingual starter packages, revision editing, preview,
publication, and test-send tools. Starter files and their generator are versioned
with the code. Seasonal folders such as `2026/` contain application assets, not
release reports.

The headers use the hosted DSCS logo, localized alt text, and a link to the shop website.

## Use the templates

Open **Admin → Email Templates → Create**. Choose one of the six 2026 starters or import a JSON package. The starters cover registration confirmation, event reminder, and cancellation in English and Spanish. The six canonical JSON packages are in `santashop-admin/src/assets/email-templates/2026/`; each includes HTML and plain text. Standalone copies are generated for review/export, not tracked as additional application assets.

JSON import creates an unsaved draft. Choose a unique key and SES name. A saved template keeps its language, delivery type, and SES name. HTML import replaces only the body after confirmation. Invalid files leave the editor unchanged. Export JSON to transfer metadata, mappings, samples, plain text, language, and review state; export HTML to transfer source with placeholders intact. Imports do not publish.

Each language has its own saved revisions and publication status. Saving a draft does not change delivery mappings. Publishing selects a saved revision. Production publication updates its SES
template; test sink mode records the revision without calling AWS. An older published revision can remain active while a newer draft is edited.

## Seasonal review is required

The 2026 starters use the confirmed venue at 1812 35th Street, Denver, CO 80216,
on the corner of Brighton Blvd. and 35th Street. Parking is on the west side of
the building off Brighton Blvd. Event dates are December 11, 12, 14, and 15,
from 10 a.m. to 3 p.m. Verify future seasonal changes and both language versions
before publishing. Do not reuse these details for another season.

Before publishing a starter, review the venue, map, parking, dates, and both language versions in HTML and plain text. Mark the seasonal review complete, then save that revision. Editing content clears review approval. The backend rejects publication of unreviewed seasonal revisions and revisions that still contain draft markers. Cancellation also requires review, but the cancellation message contains no active ticket or QR code. The customer's QR artifact remains stable for later re-registration.

## Customer language and delivery

Signup saves the current app language. Both language controls use one customer service, and signed-in changes update only the authenticated customer's profile through `updatePreferredLanguage`. Login restores the saved preference. A missing preference is initialized from the current app language; older backend clients and profiles default to English. Failed saves show a translated message with a retry action. Admin preregistration offers English or Spanish, with English selected initially.

Delivery reads the current customer profile. For each delivery type it selects the latest published template in that language, with English fallback if Spanish is unavailable. Queue records retain requested language, delivered language, selected template key and revision, and the language fallback reason. Published revision mappings are used. Cancellation retains a localized HTML and plain-text fallback until a cancellation template is published. Both versions link to the registration app, and HTML includes a registration button.

New queue records contain the appointment timestamp. Registration completion, appointment changes, manual resend, scheduled reminders, admin preregistration, and cancellation use it. Dates are formatted in the delivered language with the configured Denver timezone. Older queue records keep their stored appointment text. Duplicate-send checks, current-registration checks, cancellation checks, QR checks, provider-acceptance records, and retry handling remain in the sender.

`emailTemplateNames` reserves SES names during concurrent template creation. The template delete action releases the matching reservation. The collection contains template metadata, not customer language data.

## Registration links and environments

Use `{{registrationUrl}}` with the `registrationUrl` field mapping for registration
buttons and plain-text links. All six starters include this mapping. Delivery
uses the root URL of `SANTASHOP_PASSWORD_RESET_CONTINUE_URL`: TEST uses
`https://test.denversantaclausshop.org/`, PROD uses
`https://register.denversantaclausshop.org/`, and local emulators use localhost.
Password-reset links retain their configured sign-in continuation.

Publication converts hardcoded links for known customer domains and their
Firebase Hosting aliases to `{{registrationUrl}}`, preserving paths, queries,
and fragments. This also lets one SES template serve both environments safely.
Test sends resolve the registration link from the sending environment, even
when sample data contains another URL. Public website, FAQ, map, Facebook, and
logo links remain shared. QR download links come from the current project's
Storage bucket.

Deploy Functions with `registrationUrl` support before publishing these
templates. Existing SES templates with hardcoded links require republication
to use runtime links. Updating a starter asset does not update a saved or
published revision. Review saved content before publishing; imports still
create drafts and do not publish automatically.

## Reproduce previews

From the workspace root:

```text
node scripts/generate-2026-email-templates.mjs
node scripts/render-2026-email-previews.mjs "C:\Users\joelm\OneDrive\Documents\Notes\Joel's Obsidian Vault\Denver Santas Claus Shop\Archive\QA\2026-email-previews"
```

Open `index.html` in the specified output directory. The renderer also writes each starter’s unrendered `*.source.html` and `*.txt` beside the previews. These are optional exports from the JSON packages; edit the generator/source package, not a second tracked HTML/TXT copy. The gallery includes six rendered emails and desktop/phone screenshots. QR codes, confirmation codes, names, and appointments in these previews are fictional. The preview checker covers 360px and 800px widths, horizontal overflow, long names, Spanish dates, and essential text with images blocked. Browser rendering does not establish Outlook, Gmail, Apple Mail, or real recipient delivery behavior.

## Content references

Recheck these destinations and the event information before seasonal publication:

- [Registration and appointment management](https://register.denversantaclausshop.org/)
- [English FAQ](https://www.denversantaclausshop.org/faq-english/)
- [Spanish FAQ](https://www.denversantaclausshop.org/faq-espanol/)
- [Shop website](https://www.denversantaclausshop.org/)
- [Contact through Facebook](https://www.facebook.com/denversantaclausshop/)

Use the approved event information to review photo-ID and proof-of-age copy,
arrival instructions, venue, dates, and appointment-change guidance. Record
the dated review, preview results, and any delivered-email checks in the
project vault. Browser previews and mocked SES tests do not establish email-client
rendering or recipient delivery.
