# SantaShop Functions audit todo

Last updated: 2026-07-11

## Open issues

1. **Hardcoded privileged data in source**
   - Files: `src/fn/pubsubSetAdminRights.ts`, `src/fn/manualMigrate.ts`
   - Impact: security and operational risk from hardcoded admin UIDs, privileged UID checks, and plaintext bootstrap password.

6. **Several handlers do full scans or sleep-based loops**
   - Files: `src/fn/pubsubQueueReminderEmails.ts`, `src/fn/scheduledRegistrationStats.ts`, `src/fn/scheduledCheckInStats.ts`, `src/fn/pubsubMarkRegistrationsCheckedIn.ts`, `src/fn/pubsubDeleteUsers.ts`
   - Impact: scalability and timeout risk as data grows.

10. **Readability and type-safety debt is widespread**
   - Files: `src/fn/callableAdminPreRegister.ts`, `src/fn/callableResendRegistrationEmail.ts`, `src/fn/scheduledRegistrationStats.ts`, `src/fn/scheduledUserStats.ts`, `src/utility/registrations.ts`
    - Impact: excessive `any`, noisy promise patterns, and mixed responsibilities make the package harder to maintain safely.
   - Blocker: the targeted handlers are improved and the package passes lint/build/unit/integration validation, but focused validation still found unresolved readability/type-safety debt in the issue-10 target set, so this item cannot yet be honestly closed.
