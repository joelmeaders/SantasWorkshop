# Waiting list

The waiting list is optional. An existing customer account can join only when
its current-year registration has no appointment, completed registration, or
check-in, and no operator-enabled future appointment has available capacity.
Capacity uses the existing scheduled `slotsReserved` counters. This feature
does not add a hard booking limit, priority, or a reserved appointment.

## Controls and customer access

`santashop_waiting_list` is a separate, unconditional JSON Remote Config
parameter with `joiningEnabled` and `emailSendingEnabled` booleans. Both default
to `false`. Missing or malformed values disable these features without changing
the existing `santashop_public_parameters` schema or its operational controls.
The owner publishes these settings explicitly in **App settings**. Publication
uses the full template ETag and preserves unrelated parameters.

The customer app reuses its existing Remote Config listener. Backend handlers
reuse the private settings gateway. The gateway's normal freshness policy still
applies; callers cache waiting-list settings for ten seconds and fail closed
when the gateway reports stale data. Global email permission retains its
existing three-minute cache. Disabling a control is therefore not an instant
recall of already accepted provider requests.

The registration overview uses its loaded registration and schedule. Maintenance,
weather, and registration-closed overlays read eligibility on demand after sign-in.
They retain the closure notice and do not unlock registration. Existing-account
sign-in and password reset are available when joining is enabled. The email's
`?mode=sign-in&waitingList=manage` link also permits sign-in to manage membership
when joining is disabled. No customer-wide scan or background eligibility poll
is used.

The Join action requires explicit consent. The registration document stores
`waitingList.active`, `joinedOn`, `source`, and a membership ID. Sources are
`overview`, `maintenance`, `weather`, and `registration-closed`. The server
derives the UID, program year, and timestamp. A duplicate join preserves the
original consent details. Leaving clears only the active flag. A fresh opt-in
replaces the details. Appointment selection and completion clear the flag in
their existing transactions; cancellation does not subscribe the customer.

## Manual campaigns

The owner-only **Waiting list** tool previews the active audience count and both
published email languages. A launch requires explicit confirmation, both sending
controls, open registration, future capacity, and published English and Spanish
`waiting-list-capacity` templates. The starter templates are available in the
existing template editor, publication, and test-send tools. They include HTML,
plain text, a registration-site button, and the membership link for the current
environment. Publish both languages before enabling campaigns.

A campaign freezes its audience cutoff and rendered template revisions. It reads
only active current-year memberships in pages of 50. Subscribers who join later
wait for the next campaign. Each delivery rereads the registration and customer
profile, including the current email address and saved language. It skips opt-outs
and customers who have booked or registered, and clears stale active flags.
If capacity fills during a campaign, processing continues through its original
audience. The email states that it does not reserve an appointment. Successful
notification does not remove membership.

Campaigns and deterministic `deliveries/{uid}` receipts live in
`waitingListCampaigns`, separate from registration email queues. Receipts record
**accepted**, **skipped**, **failed**, and **uncertain** results separately.
Accepted means SES accepted the request, not confirmed inbox delivery. A receipt
is claimed before the provider request. A crash or unknown provider outcome is
uncertain and is never resent automatically in that campaign. Review these
receipts before starting a later campaign; the campaign tool does not promise
exactly-once external delivery.

The task worker has one instance, concurrency one, a 540-second timeout, and five
queue attempts. It checkpoints after 50 members or 420 seconds. The send rate
is the smaller of five messages per second and half of the verified SES quota.
SES SDK retries are disabled for these sends. A ten-minute lease prevents two
tasks from processing the same campaign concurrently. The worker pauses on
disabled/unavailable permission or processing failure. **Resume** retains the
cutoff, templates, and terminal receipts. An interrupted lease must expire before
manual resume. The campaign lock is released only by its matching campaign.

Annual reset includes campaign records and nested delivery receipts. This data
model change does not authorize running a reset. Templates and settings retain
their existing lifecycle.

## Deployment and validation

Follow the existing TEST → owner approval → PROD process. Keep both flags disabled
through deployment. Deploy the new indexes, callable Hosting rewrites, Functions,
and both apps before publishing either flag. Preserve the task endpoint's private
IAM policy. Following the [Firebase task queue permissions](https://firebase.google.com/docs/functions/task-functions#iam_permissions),
the configured reader identity used by launch/resume/worker requires task enqueue
permission on `waitingListEmailWorker`, permission to act as its task identity,
and invocation permission on the private worker. The worker's invoker is the
Admin SDK task identity (`SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT` when configured,
otherwise the reader runtime identity). Verify these grants in TEST
before enabling delivery; do not grant public invocation or broaden unrelated
queues. The SES identity must allow `GetSendQuota` and `SendEmail`.

`verify-functions-managed-resources.cjs` checks both task queues and the dedicated
worker retry/rate limits. Remote Config consumer readiness includes the new
gateway callers. These checks complement live IAM and indexed-query verification;
emulators cannot prove cloud IAM, index readiness, or SES provider limits.

Emulator campaign delivery is simulated only when `_testConfig/emailSending`
contains both `enabled: true` and `simulateWaitingList: true`. It never calls SES.
The owner results label simulated campaigns. Use isolated fixtures for customer,
campaign, and slot-control tests. Do not send customer campaigns or change
production appointments during validation.

Storybook groups are **Registration/Waiting List** and **Admin/Waiting List**.
Run `pnpm storybook` for the interactive preview. Fixtures cover English/Spanish,
customer light styling, admin light/dark themes, consent, error/retry, closure
sign-in, publication conflicts, campaign recovery, email layouts, and year-round
slot controls. The customer app does not currently offer a separate dark theme.
Operators can open/close slots in any month, including past dates; customer
booking remains limited to future appointments. Scheduled reconciliation must
preserve the operator's enabled flag.
