# TODOS: sign-in consent (web, branch `feat/otp-consent`)

Findings from building the 18+ / Terms of Use box on the sign-in code step (2026-11-08). The web repo has no
`docs/TODOS.md`, so they are filed here. Server contract: `docs/auth/otp-consent-contract.md` in the server repo
(branch `feat/signup-signin-alerts`).

## Open

1. **Legal review of the new Terms wording (Sachin / counsel).** Section 10 "Using what you see in the app" in
   `src/pages/legal/LegalPages.tsx`, the "also called our Terms of Use" line in section 2, and the checkbox text on
   sign-in were written by an agent. Check: "screenshot for distribution", "use them to train software", "except as
   the law allows", the line extending the rule to content about people whose details the user enters, and that
   each sign-in re-confirms 18+ and the whole Terms. Sections 10 to 16 were renumbered to 11 to 17; the survival
   list in section 12 now reads 1, 4, 9, 10, 13, 14 and 16.
2. **Name mismatch: "Terms of Service" vs "Terms of Use".** The page title, SEO title, footer (`i18n/en.ts`), the
   sign-up box and `TERMS_REQUIRED_MESSAGE` say "Terms of Service"; the sign-in box and the server messages say
   "Terms of Use". The page now says it is also called the Terms of Use. Pick one name and apply it everywhere.
3. **Sign-up box does not mention the no-copying rule.** It records acceptance of the whole Terms at the same
   version, so it is covered legally, but the wording differs from sign-in. Decide whether to align it.
4. **Ship order matters.** The web now asks for `code` in the `loginWithMagicLink` and `verifySignupCode` selections
   and sends `termsAccepted` / `termsVersion`. Against a server without these the GraphQL request fails and every
   sign-in shows the generic code error. Deploy the server first (contract rollout steps 1 and 2), then the web.
5. **Sign-in box shows again right after sign-up.** A person arriving from sign-up (already ticked the sign-up box)
   must tick the sign-in box too. Accepted as decided (every sign-in confirms); revisit if it reads as friction.
6. **`LEGAL_UPDATED` is still 2 November 2026 for Privacy and Refunds.** Only the Terms page moved to
   `TERMS_UPDATED` (8 November 2026). Correct today, but each page's date now has to be bumped on its own.
