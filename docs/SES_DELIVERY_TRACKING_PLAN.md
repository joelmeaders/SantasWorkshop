# AWS SES Delivery Tracking Plan

Status: planned; not implemented

## Outcome

Santa's Workshop will distinguish an email accepted by Amazon SES from an email
delivered to the recipient's mail server. Every SES send will have an immutable,
correlated Firestore attempt record, and asynchronous SES delivery events will
update that record without allowing duplicate or out-of-order notifications to
corrupt the final result.

The first usable slice includes backend capture, persistence, operational
alerts, and test/prod rollout. An admin delivery-history screen is a separate
follow-up because it is not required to reliably obtain and store the result.

This plan satisfies the failed-communication requirement in
`NFR-MNT-005` and follows the repository's test-before-production and
GitHub-only Functions deployment rules.

## Current behavior and gap

- `sendNewRegistrationEmails2.ts` records the SES `MessageId` and API
  acceptance, then immediately marks the queue and registration as sent.
- SES API acceptance means SES accepted the request and will attempt delivery;
  it is not evidence that the recipient's mail server accepted the message.
- The queue is `tmp_registrationemails/{uid}`. It is suitable as a current-state
  mirror but not as immutable history because later email requests reuse the
  same UID-keyed document.
- `callableResendRegistrationEmail.ts` merges `deliveryState: queued` into that
  document, while the sender currently uses `onDocumentCreated`. An update to an
  existing document may therefore not dispatch the resend.
- Normal emulator and E2E runs intentionally skip SES. That safety behavior must
  remain unchanged.

## Recommended architecture

```text
Firestore email queue
        |
        v
Firebase send worker -- configuration set + delivery ID tag --> Amazon SES
        |                                                        |
        v                                                        v
emailDeliveryAttempts/{attemptId}                         SNS standard topic
                                                                 |
                                                                 v
                                                   public HTTPS Firebase Function
                                                                 |
                                                                 v
                                               verified, normalized Firestore event
```

Use SES configuration-set event publishing to an Amazon SNS Standard topic.
Subscribe a public Firebase HTTPS Function to the topic. The Function is public
because SNS cannot provide Firebase Auth or App Check credentials; its trust
boundary is the validated SNS signature and exact expected Topic ARN.

Do not poll SES. Do not use identity-level feedback notifications for this
feature because configuration-set publishing carries message tags used for
deterministic correlation.

AWS references:

- [Set up SES event publishing](https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-using-event-publishing-setup.html)
- [Specify configuration sets and message tags when sending](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-send-email.html)
- [Configure an SNS event destination](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-add-event-destination-sns.html)
- [Verify SNS message signatures](https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html)
- [Use the SES mailbox simulator](https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html)

## Delivery state contract

| State | Meaning | Terminal |
| --- | --- | --- |
| `queued` | Application created the email request. | No |
| `sending` | One worker owns the SES send attempt. | No |
| `accepted` | SES accepted the API request and returned a message ID. | No |
| `delayed` | SES reported a temporary delivery delay. | No |
| `delivered` | The recipient's mail server accepted the email. | Yes for delivery |
| `failed` | The API call failed, SES rejected/render-failed the message, or delivery ended in a bounce. | Yes |
| `complained` | Delivery occurred and the recipient later marked it as spam. | Yes |

The attempt also stores independent timestamps such as `acceptedOn`,
`deliveredOn`, `failedOn`, and `complainedOn`. This preserves the fact that a
complaint occurs after delivery rather than pretending the earlier delivery did
not happen.

State reduction must be deterministic and safe for duplicate or out-of-order
events:

- an API acceptance write must never downgrade `delivered`, `failed`, or
  `complained`;
- `DeliveryDelay` can move `accepted` to `delayed`, but a later `Delivery` can
  move it to `delivered`;
- `Bounce`, `Reject`, and `RenderingFailure` produce `failed` with a normalized
  failure kind;
- `Complaint` produces `complained` while retaining `deliveredOn` when known;
- a late `Send` or `DeliveryDelay` event cannot replace a terminal outcome;
- no event automatically resends email.

`reminderEmailSentOn` must be set only after an SES `Delivery` event. Immediate
SES/API failures and final delivery failures set `reminderEmailFailedOn`.
Cancellation and template-test attempts do not change reminder fields.

## Firestore data design

Add the following server-owned collections to `COLLECTION_SCHEMA`.

### `emailDeliveryAttempts/{attemptId}`

Create one immutable identity per actual SES API attempt before calling SES.
Suggested fields:

```ts
interface EmailDeliveryAttempt {
  id: string;
  provider: 'aws-ses';
  state: 'sending' | 'accepted' | 'delayed' | 'delivered' | 'failed' | 'complained';
  communicationType:
    | 'registration-confirmation'
    | 'registration-reminder'
    | 'registration-cancellation'
    | 'template-test';
  queueDocumentPath?: string;
  registrationUid?: string;
  programYear?: number;
  templateKey?: string;
  templateName?: string;
  requestedOn: Date;
  attemptedOn: Date;
  acceptedOn?: Date;
  deliveredOn?: Date;
  delayedOn?: Date;
  failedOn?: Date;
  complainedOn?: Date;
  sesMessageId?: string;
  configurationSetName: string;
  failureKind?: 'api' | 'bounce' | 'reject' | 'rendering-failure';
  failureCode?: string;
  failureDetail?: string;
  lastEventType?: string;
  lastEventOn?: Date;
}
```

Do not duplicate the full recipient address, subject, rendered body, SNS
headers, or raw event payload. The queue or registration reference already
provides authorized support correlation. A template-test attempt may store only
the actor UID and a masked recipient address.

### `emailDeliveryAttempts/{attemptId}/events/{snsMessageId}`

Store one normalized event per SNS message. Using the SNS `MessageId` as the
document ID makes repeated delivery idempotent. Store only:

- SES event type and event timestamp;
- SES `mail.messageId`;
- bounce type/subtype, SMTP status/action, and bounded diagnostic text when
  applicable;
- complaint feedback type when present;
- delivery-delay type when present;
- processing timestamp and receiver version.

Truncate provider strings to bounded lengths. Do not store raw headers or
recipient lists.

### `sesUnmatchedEvents/{snsMessageId}`

Quarantine validly signed events that lack a known `santashop_delivery_id` tag.
Store the SES message ID, event type, timestamps, and a bounded reason. This is
an operational exception collection, not a normal matching path.

### Queue compatibility fields

Continue using `tmp_registrationemails/{uid}` as the latest request/status
mirror. Add:

- `activeDeliveryAttemptId`;
- `deliveryState` with the new state meanings;
- final provider timestamps and sanitized failure fields;
- `deliveryRequiresReviewOn` and reason for ambiguous sends or unmatched
  outcomes.

Only update the queue mirror when its `activeDeliveryAttemptId` matches the
attempt being processed. This prevents a late event from an older send from
overwriting a newer resend.

Firestore rules must explicitly deny all client reads and writes to attempts,
event subcollections, and unmatched events. A future admin UI should read them
through an admin-authorized callable with pagination and redaction.

## Inbound SNS security contract

Create `receiveSesSnsEvent` as an `onRequest` Function with a public invoker.
The handler must perform these checks before following a URL or writing data:

1. Require `POST`, a bounded body size, and a valid SNS envelope.
2. Require the envelope `TopicArn` to exactly equal
   `SES_EVENT_SNS_TOPIC_ARN` for the deployed environment.
3. Require `SigningCertURL` to use HTTPS and a valid Amazon SNS hostname in the
   configured region. Do not permit redirects to an untrusted host.
4. Reconstruct the documented canonical string and validate SNS signature
   versions 1 and 2 with Node's `crypto` APIs. Cache validated certificates for
   a bounded period.
5. For `SubscriptionConfirmation`, validate the signature and Topic ARN first,
   then validate and fetch the SNS `SubscribeURL`. Never log the token or full
   URL.
6. For `Notification`, parse the nested SES JSON, require the configured SES
   configuration-set tag, and correlate primarily through
   `santashop_delivery_id`.
7. Persist the normalized event and reduce attempt/queue/registration state in
   a Firestore transaction.
8. Return 2xx only after the event is durably stored. Return 5xx for transient
   Firestore failures so SNS retries. Reject invalid signatures and unexpected
   topics without revealing validation detail.

Set the SNS topic to signature version 2 after the receiver has verified support
for it. Keep raw message delivery disabled because the receiver needs the signed
SNS envelope.

## Application implementation work

### 1. Define models and configuration

- Add delivery attempt, event, failure-kind, communication-type, and state
  models under `santashop-models/src/lib/` and export them from the public API.
- Add `emailDeliveryAttempts` and `sesUnmatchedEvents` to
  `santashop-models/src/lib/schema.ts`.
- Add required runtime configuration:
  - `SES_EVENT_CONFIGURATION_SET`
  - `SES_EVENT_SNS_TOPIC_ARN`
- Add matching `TEST_*` and `PROD_*` values to `.env.example`,
  `config.functions.cjs`, GitHub secret documentation, and deployment tests.
  The Topic ARN and configuration-set name are not secret, but the current
  repository intentionally routes all Functions environment inputs through the
  same GitHub-generated dotenv mechanism.

### 2. Make send attempts durable

- Refactor `sendNewRegistrationEmails2.ts` so claiming the queue also creates
  the attempt and writes `activeDeliveryAttemptId` before the SES API call.
- Supply `ConfigurationSetName: SES_EVENT_CONFIGURATION_SET` and tags including
  `santashop_delivery_id`, communication type, and environment on every
  `SendEmailCommand` and `SendTemplatedEmailCommand`.
- Keep tags ASCII and non-PII.
- On a successful SES API response, store `accepted` and `sesMessageId`; do not
  mark the attempt or registration delivered.
- On a definite API error before acceptance, mark the attempt and queue
  `failed` with sanitized details.
- Preserve the existing ambiguous-send safeguard: if SES may have accepted the
  email but Firestore state cannot prove it, require review instead of blindly
  sending again.
- Reuse the same attempt creation/send helper from
  `callableSendTestEmailTemplate.ts` so test emails are also traceable.

### 3. Make resends dispatch reliably

- Change the queue trigger in `santashop-functions/src/index.ts` from creation
  only to a guarded document-write trigger.
- Dispatch only when the after-state is newly created/legacy-unset or transitions
  from a non-queued state to `queued`.
- Ignore the worker's own `sending`, `accepted`, `delayed`, `delivered`, and
  failure writes.
- Keep Firestore event ID claims and active-attempt checks so trigger retries do
  not create duplicate SES calls.
- Add a resend regression test proving an existing queue document transitions
  to `queued`, sends once, and gets a distinct attempt ID.

### 4. Receive and reduce SES events

- Add a narrow SNS envelope verifier utility.
- Add an SES event parser that accepts only the selected event types and returns
  a normalized internal event.
- Add a pure state reducer with explicit precedence rules.
- Add the public HTTPS receiver export to `index.ts`, with structured redacted
  logging through the existing observability helpers.
- Update `reminderEmailSentOn` only for a matching delivered reminder or
  confirmation attempt. Preserve cancellation and template-test separation.

### 5. Lifecycle, reset, and support integration

- Add the new collections to emulator cleanup.
- Include seasonal delivery attempts and unmatched events in the complete reset
  workflow and preview counts. They are customer-linked seasonal data.
- Retain only non-PII aggregate counts after reset if delivery reporting is
  needed year over year.
- Add composite indexes only for actual operational queries, initially:
  `programYear + state + lastEventOn` if the support/reporting callable is
  included.
- Add a runbook section to `docs/SECRETS_AND_CONFIGURATION.md` covering AWS
  resources, subscription health, DLQ review, and credential-independent event
  receipt troubleshooting.

## AWS configuration

Create separate test and production resources even if both environments use the
same AWS account. Use the same region as `SES_REGION`; SES supports only SNS
Standard topics for this destination.

Suggested names:

| Resource | Test | Production |
| --- | --- | --- |
| SES configuration set | `santashop-delivery-test` | `santashop-delivery-prod` |
| SNS topic | `santashop-ses-events-test` | `santashop-ses-events-prod` |
| SNS event destination | `santashop-delivery-events` | `santashop-delivery-events` |
| SQS dead-letter queue | `santashop-ses-events-dlq-test` | `santashop-ses-events-dlq-prod` |

### Browser-assisted implementation checkpoint

AWS changes are not made during planning. During implementation:

1. Finish the receiver and local tests first.
2. Ask the user to sign in to the AWS console in the in-app browser. Do not ask
   for, view, copy, or store the AWS password or MFA secret.
3. Use the signed-in browser session to configure test resources and capture
   only non-secret names/ARNs needed by the repository configuration.
4. Deploy through the GitHub test workflow, obtain the deployed HTTPS Function
   URL, then return to AWS to create and confirm the HTTPS subscription.
5. Complete live test verification before requesting browser access for the
   production configuration.

### AWS test-environment steps

1. Confirm the SES region, AWS account ID, verified sending identity, and current
   sending status. Do not expose credential values.
2. In Amazon SQS, create the Standard DLQ with 14-day retention and server-side
   encryption. Record its ARN.
3. In Amazon SNS, create the Standard test topic. Keep raw message delivery off.
4. Change the topic `SignatureVersion` attribute to `2` after receiver support
   has been validated.
5. Set the topic access policy to allow only `ses.amazonaws.com` to call
   `sns:Publish`, constrained by:
   - `AWS:SourceAccount` equal to the expected AWS account;
   - `AWS:SourceArn` equal to
     `arn:aws:ses:<region>:<account-id>:configuration-set/santashop-delivery-test`.
6. In SES, create `santashop-delivery-test`.
7. Add an enabled SNS event destination selecting:
   - Send;
   - Rendering failure;
   - Reject;
   - Delivery;
   - Hard bounce;
   - Complaint;
   - Delivery delay.
8. Point the destination at the test SNS topic.
9. Store the test configuration-set name and topic ARN as the matching
   repository-level GitHub Functions configuration inputs, then deploy using the
   existing GitHub-only test workflow.
10. In SNS, subscribe the deployed `receiveSesSnsEvent` HTTPS URL. The receiver
    must confirm only the expected, validly signed topic subscription.
11. Attach the SQS DLQ to the HTTPS subscription with a redrive policy and give
    SNS permission to write to that queue. Configure HTTP/S retries and delivery
    status logging.
12. Confirm the subscription is `Confirmed`, the SES destination is enabled,
    and the DLQ is empty before live tests.

Repeat the same sequence for production only after test acceptance, substituting
the production project, configuration set, topic, queue, and GitHub inputs.

## Validation plan

### Unit tests

- SES command includes the expected configuration set and non-PII correlation
  tags for templated, cancellation, and template-test sends.
- Attempt creation precedes the SES call and survives accepted, definite-error,
  and ambiguous-error paths.
- SNS canonical-string generation and signature validation cover versions 1 and
  2, invalid signatures, invalid certificate hosts, unexpected Topic ARNs,
  malformed JSON, and confirmation messages.
- Parser fixtures cover `Send`, `Delivery`, `DeliveryDelay`, `Bounce`,
  `Complaint`, `Reject`, and `RenderingFailure`.
- Reducer tests cover every valid transition, duplicate event, late event, and
  attempted terminal-state downgrade.
- Stored and logged objects contain no full raw SNS body, subject, rendered HTML,
  confirmation code, or unmasked recipient address.
- An existing UID-keyed queue document can be requeued and produces exactly one
  new attempt.

### Emulator integration tests

- Signed fixture notifications persist one normalized event and update the
  attempt, queue mirror, and registration atomically.
- Replaying the same SNS `MessageId` is a no-op.
- An older attempt cannot overwrite a newer queue attempt.
- Valid but unmatched events enter quarantine.
- Transient Firestore failures return a retryable status.
- Normal emulator tests continue to avoid AWS network calls.

### Live test checks

Use SES mailbox simulator recipients through the application send path:

| Scenario | Recipient | Expected stored result |
| --- | --- | --- |
| Delivery | `success@simulator.amazonses.com` | `delivered` |
| Hard bounce | `bounce@simulator.amazonses.com` | `failed` / `bounce` |
| Complaint | `complaint@simulator.amazonses.com` | `complained` |
| Suppression | `suppressionlist@simulator.amazonses.com` | `failed` / `bounce` |

Also verify one controlled template rendering failure with a test-only template
or fixture. Do not test reject behavior with antivirus content unless separately
approved; it is unnecessary for release confidence.

For every live case, verify:

- one attempt exists before/at SES acceptance;
- SES `mail.messageId` matches the stored provider message ID;
- one normalized event exists per SNS notification;
- queue and registration summary fields match the final outcome;
- no recipient address or message body appears in logs;
- SNS delivery failure metrics remain zero and the DLQ stays empty.

Repository validation commands:

```powershell
pnpm --filter @santashop/models build
pnpm --filter @santashop/functions lint
pnpm --filter @santashop/functions test:unit
pnpm run functions:test:integration
pnpm --filter @santashop/functions build
```

Run the relevant admin/public E2E slices only if delivery status becomes visible
in a UI. Backend capture alone does not require the full Playwright suites.

## Observability and operational response

Emit structured, PII-free logs for:

- SES API accepted/failed;
- SNS subscription confirmed/rejected;
- SNS event stored/duplicate/unmatched;
- delivery delayed/delivered/failed/complained;
- invalid signature or unexpected topic;
- attempt stuck in `sending`, `accepted`, or `delayed` beyond thresholds.

Create alerts for:

- any invalid-signature surge;
- unmatched events;
- SNS HTTP delivery failures;
- non-empty DLQ;
- attempts remaining `sending` longer than the current stale-send threshold;
- attempts remaining `accepted` or `delayed` beyond an agreed operational
  threshold;
- bounce and complaint rates above an agreed threshold.

The first operational owner is the application owner/admin. Automatic resend is
not part of this slice. Staff may perform a reviewed manual resend only after
checking the failure kind and recipient address.

## Rollout and rollback

### Rollout order

1. Add models, receiver, state reducer, attempt persistence, tests, and
   configuration support without enabling a production configuration set.
2. Configure AWS test resources through the signed-in browser session.
3. Deploy Functions to the Firebase test project through GitHub Actions.
4. Subscribe SNS and validate confirmation/signature behavior.
5. Run mailbox-simulator and one normal test-recipient smoke test.
6. Observe test events, logs, alerts, and DLQ for at least one complete test
   cycle.
7. Configure and deploy production through the GitHub production workflow.
8. Send one controlled production smoke email and verify the final stored
   delivery event.

### Compatibility and historical data

- Existing queue records retain their legacy fields. New status semantics apply
  only to sends created after the feature is enabled.
- Past delivery outcomes cannot be reconstructed from SES event publishing.
- During mixed deployment, the queue remains readable by existing code while
  new attempt records are additive and server-only.

### Rollback

If the receiver is unhealthy:

1. Disable the SES event destination or SNS subscription to stop callback
   pressure while preserving the topic/DLQ.
2. Leave configuration-set tagging on sends if SES sending itself is healthy;
   it is harmless without an enabled destination.
3. Roll back the Function code through the normal GitHub release path.
4. Do not reinterpret `accepted` as delivered during the outage. Mark affected
   attempts for reconciliation/review.
5. Replay DLQ events only after the repaired receiver passes signature and
   idempotency tests.

## Acceptance criteria

- Every application-issued SES call has exactly one durable attempt ID before
  the external send.
- SES acceptance is stored as `accepted`, never as delivery success.
- A valid SES `Delivery` event changes the matching attempt to `delivered` and
  sets registration delivery fields only when applicable.
- Bounce, complaint, reject, rendering failure, delay, and direct API failure
  are stored distinctly with bounded, sanitized metadata.
- Duplicate and out-of-order SNS deliveries cannot corrupt state.
- Forged, incorrectly signed, wrong-topic, or untrusted-certificate messages
  cannot write Firestore or trigger subscription confirmation.
- Manual resends from an existing queue document dispatch once and create a new
  attempt.
- Emulator/E2E runs do not contact SES unless explicitly opted in.
- Test AWS configuration, mailbox-simulator evidence, SNS subscription health,
  and an empty DLQ are verified before production promotion.

## Deferred work

- Admin delivery-history/filtering UI.
- Automatic suppression-list management from bounce/complaint events.
- Automatic resend policy.
- Campaign/open/click analytics.
- Migration from the UID-keyed compatibility queue to a fully immutable outbox.

