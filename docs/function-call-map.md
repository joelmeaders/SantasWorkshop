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

Both deployed environments ordinarily use SES. The independent email-sending
control must permit delivery, and emulator delivery remains disabled by default.
Do not remove these controls when simplifying the queue implementation. See
[configuration and email control](SECRETS_AND_CONFIGURATION.md#remote-email-sending-control).

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
