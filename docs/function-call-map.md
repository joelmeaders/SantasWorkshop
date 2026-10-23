# Runtime call boundaries

This is maintained guidance for reviewing calls, queue writes, triggers, and
continuations. It is not a generated inventory, source-hash approval gate, live
cloud inventory, or proof that the application is acyclic. Exported endpoints
and their resource/security options are defined in
[`src/index.ts`](../santashop-functions/src/index.ts).

## Customer mutations and configuration

App callables pass through `FunctionsWrapper` to authenticated backend handlers.
Draft-child edits share the narrow
[`mutateDraftChildren`](../santashop-functions/src/fn/mutateDraftChildren.ts)
transaction protocol. Save/delete authenticate and validate their own input;
registration and mutation receipt are read before writes, and the receipt is
created atomically with the update. A successful replay is returned before
current draft/feature checks. Appointment selection, submission, cancellation,
and check-in retain their own transaction and authorization rules.

Email changes require a fresh authenticated token, an operation ID, and the
expected current email. The backend stores the intent and a short invocation
lease under `users/{uid}/emailChanges` before changing Auth. The final batch
updates the user and any existing registration/search records together with
the completion receipt. A failed batch leaves a retryable intent; a lost batch
acknowledgement is resolved by reading Auth and that receipt. No rollback to an
old token email occurs. Completed older operation IDs cannot replace a newer
intent. An interrupted invocation reserves its intent for two minutes; retain
the callable's 60-second limit when changing this lease. Recovery remains an
authenticated customer action, with no background continuation or account scan.
Deploy the matching client request contract with the backend and refresh older
clients before retrying. Browser rules do not grant access to the private intent
subcollection. Annual recursive user deletion also removes its receipts.

Deployed registration handlers read cached public settings through the private
`publicParametersGateway`. Reader and publisher identities are deliberately
separate. Local emulator settings are fixtures, not a second deployed source of
truth. See [Remote Config](remote-config.md) for caching and fail-closed behavior.

## Email queue: never recreate a triggering document

Completion, appointment changes, cancellation, reminders, and staff actions can
create `tmp_registrationemails` records. The `sendNewRegistrationEmails`
**create** trigger invokes
[`sendRegistrationEmail`](../santashop-functions/src/fn/sendRegistrationEmail.ts).
Its status/receipt writes must update existing queue records only. Replacing an
update with `set(..., {merge: true})` can recreate a deleted document and invoke
the create trigger again. Preserve duplicate/provider-acceptance checks and
retry semantics; a cloud redelivery need not correspond to a new source edge.

Confirmation delivery retains the legacy `reminderEmail*` status fields.
Event reminders use separate `eventReminder*` fields. Owner preview and queue
admission share the same candidate query. A transaction reserves the reminder
before creating its queue record. Existing queue records with the event-reminder
template also reserve that allowance. Legacy status flags alone cannot establish
which template was sent; they do not exclude a first event reminder. This change
does not clear old flags or launch a campaign. If historical queue evidence was
deleted, the old flags cannot reconstruct that delivery history.

Both deployed environments ordinarily use SES. The independent email-sending
control must permit delivery, and emulator delivery remains disabled by default.
Do not remove these controls when simplifying the queue implementation. See
[configuration and email control](SECRETS_AND_CONFIGURATION.md#remote-email-sending-control).

## Waiting-list campaign boundaries

The authenticated membership callable updates only the customer's registration
and its mutation receipt. Booking and completion clear membership in their own
transactions. These flag writes do not create email queue records.

Owner launch/resume callables enqueue `waitingListEmailWorker`. The worker reads
up to 50 active memberships before its frozen cutoff, writes separate campaign
delivery receipts, and calls SES directly. It never creates
`tmp_registrationemails` documents. A continuation advances a saved cursor or
checkpoints the remaining batch within a 420-second work budget. An empty page
completes the campaign; disabled/unavailable permission or an error pauses it.
Terminal delivery receipts, including uncertain outcomes, are not resent.
Retries retain the cutoff and templates. Queue retry limits alone do not bound
new continuations; the fixed cutoff and advancing cursor do.

Annual reset recursively removes campaign customer records. See
[waiting-list operations](waiting-list.md) for controls, private task IAM,
leases, receipt semantics, and emulator-only simulated delivery.

## Owner worker: bounded backup continuation, resumable purge

[`ownerOperationWorker`](../santashop-functions/src/fn/ownerOperationWorker.ts)
can enqueue itself every 30 seconds while a yearly-reset backup is pending.
The backup wait has a one-hour budget from the original operation `createdAt`,
including queue delay. Preserve deadline checks before and after the backup
request and before enqueueing or starting deletion. An external export may
finish after the deadline; that does not authorize a late purge.

Persist `purgeStartedAt` before deletion. A retry of an already-started partial
purge must resume without restarting backup polling or applying the backup
wait budget to the purge. Terminal redelivery may retry lock cleanup but must
not restart destructive work. Release a lock transactionally only when its
`operationId` matches the operation being completed.

Auth deletion waits 1.1 seconds before each batch request, including the first.
Quota errors retry the same batch up to five total attempts, with exponential
delays. These retries stay inside the current task and retain its lock. Other
errors and exhausted retries use the existing task failure path. Record success
counts only after a batch returns, and never mark Auth complete after a partial
failure. This follows the [Firebase batch deletion limit](https://firebase.google.com/docs/auth/limits#account_creation_and_deletion_limits).

The task retry limit does not bound a chain of newly enqueued tasks. The backup
budget is an operational policy, not a measured backup SLA or a strict dispatch
count limit. Before deploying over an older worker revision, inspect active
resets that may lack the purge marker; code cleanup does not authorize changing
those records or performing an annual reset.

## Review and validation

Trace the actual operation: local helper calls, callable/HTTP targets, task
queues, and Firestore create/update/delete events. A merge-set can create;
imports and reads alone are not runtime call edges. Document a new continuation's
stop condition and preserve the production-data restrictions in `AGENTS.md`.

Run focused boundary tests, then the affected emulator journeys. In particular:

- [Worker continuation tests](../santashop-functions/test/unit/fn/ownerOperationWorker-cycle.spec.ts)
  cover deadlines, terminal redelivery, purge resumption, and lock ownership.
- [Email sender tests](../santashop-functions/test/unit/fn/sendRegistrationEmail.spec.ts)
  cover delivery and queue behavior; keep update-only/deleted-record regressions.
- [Draft mutation tests](../santashop-functions/test/unit/fn/registrationDraftMutations.spec.ts)
  cover validation, replay, and child updates.

These tests protect selected runtime contracts. They do not replace review of
new paths, external callers, deployed triggers, IAM, or live schedules. The
retired whole-source hash and generated graph checks are not release gates.
