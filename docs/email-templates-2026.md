# 2026 bilingual email templates

The implementation is in `D:\SantasWorkshop-email-templates-2026`, on `feat/2026-bilingual-email-templates`, rebased on freshly fetched remote master commit `d5a2bbd`. The existing checkout was preserved. Nothing was deployed, published to live SES, or emailed to a real recipient.

The headers use the original hosted DSCS logo from the 2025 email, with localized alt text and a link to the shop website.

## Use the templates

Open **Admin → Email Templates → Create**. Choose one of the six 2026 starters or import a JSON package. The starters cover registration confirmation, event reminder, and cancellation in English and Spanish. Source JSON, HTML, and plain-text files are in `santashop-admin/src/assets/email-templates/2026/`.

JSON import creates an unsaved draft. Choose a unique key and SES name. A saved template keeps its language, delivery type, and SES name. HTML import replaces only the body after confirmation. Invalid files leave the editor unchanged. Export JSON to transfer metadata, mappings, samples, plain text, language, and review state; export HTML to transfer source with placeholders intact. Imports do not publish.

Each language has its own saved revisions and publication status. Saving a draft does not change delivery mappings. Publishing selects a saved revision and updates its SES template. An older published revision can remain active while a newer draft is edited.

## Seasonal review is required

The historical email was recovered from `0b53b93^:santashop-functions/src/utility/assets/reg-conf-email.json`. Its venue was South Lowry Marketplace, 7150 Leetsdale Drive, Unit 380, Denver, CO 80224. That venue is visibly marked **unconfirmed for 2026** in confirmation and reminder starters. The old December 12 opening is not presented as the confirmed 2026 opening.

Before publishing a starter, replace the draft venue and opening notes in both HTML and plain text with confirmed information. Review both languages, mark the seasonal review complete, then save that revision. Editing content clears review approval. The backend rejects publication of unreviewed seasonal revisions and revisions that still contain the supplied draft markers. Cancellation also requires review, but contains no active ticket or QR code.

## Customer language and delivery

Signup saves the current app language. Both language controls use one customer service, and signed-in changes update only the authenticated customer's profile through `updatePreferredLanguage`. Login restores the saved preference. A missing preference is initialized from the current app language; older backend clients and profiles default to English. Failed saves show a translated message with a retry action. Admin preregistration offers English or Spanish, with English selected initially.

Delivery reads the current customer profile. For each delivery type it selects the latest published template in that language, with English fallback if Spanish is unavailable. Queue records retain requested language, delivered language, selected template key and revision, and the language fallback reason. Published revision mappings are used. Cancellation retains a localized plain-text fallback until a cancellation template is published.

New queue records contain the appointment timestamp. Registration completion, appointment changes, manual resend, scheduled reminders, admin preregistration, and cancellation use it. Dates are formatted in the delivered language with the configured Denver timezone. Older queue records keep their stored appointment text. Duplicate-send checks, superseded-ticket checks, cancellation checks, QR checks, provider-acceptance records, and retry handling remain in the sender.

`emailTemplateNames` reserves SES names during concurrent template creation. The template delete action releases the matching reservation. The collection contains template metadata, not customer language data.

## Reproduce previews

From the workspace root:

```text
node scripts/generate-2026-email-templates.mjs
node scripts/render-2026-email-previews.mjs
```

Open `.artifacts/email-templates-2026/index.html`. The gallery includes six rendered emails and desktop/phone screenshots. QR codes, confirmation codes, names, and appointments in these previews are fictional. The preview checker covers 360px and 800px widths, horizontal overflow, long names, Spanish dates, and essential text with images blocked. Browser rendering does not establish Outlook, Gmail, Apple Mail, or real recipient delivery behavior.

## Verified links and content sources

The registration, map, English FAQ, Spanish FAQ, website, and Facebook destinations returned HTTP 200 on September 6, 2026. The map points to the historical address and does not confirm its use in 2026.

- [Registration and appointment management](https://register.denversantaclausshop.org/)
- [English FAQ](https://www.denversantaclausshop.org/faq-english/)
- [Spanish FAQ](https://www.denversantaclausshop.org/faq-espanol/)
- [Shop website](https://www.denversantaclausshop.org/)
- [Contact through Facebook](https://www.facebook.com/denversantaclausshop/)

The current FAQs support the photo-ID and proof-of-age instructions and state that the location and dates can change each year. Historical instructions to arrive on time and update appointments in advance were retained.

## Validation

Final results are recorded in `email-templates-2026-validation.md`. Browser tests used an isolated local emulator stack with outbound queue email delivery suppressed. No browser test clicked the live publish or test-send actions. Backend SES behavior was checked with mocked provider commands. This is local and emulator evidence, not deployed QA or email-client delivery evidence.
