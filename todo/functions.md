# SantaShop Functions audit todo

Last updated: 2026-07-30

## Open issues

10. **Readability and type-safety debt is widespread**
   - Files: `src/fn/callableAdminPreRegister.ts`, `src/fn/callableResendRegistrationEmail.ts`, `src/fn/scheduledRegistrationStats.ts`, `src/fn/scheduledUserStats.ts`, `src/utility/registrations.ts`
    - Impact: excessive `any`, noisy promise patterns, and mixed responsibilities make the package harder to maintain safely.
   - Blocker: the targeted handlers are improved and the package passes lint/build/unit/integration validation, but focused validation still found unresolved readability/type-safety debt in the issue-10 target set, so this item cannot yet be honestly closed.
