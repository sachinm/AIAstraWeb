# GEMINI.md — AI AdAstra Web (`AIAstra_WEB`)

Follow [`AGENTS.md`](file:///c:/Users/Owner/Documents/work/AIAstra_Server/AGENTS.md) for all multi-agent collaboration, branch hygiene (`develop` `--no-ff`), worktree retirement (`git worktree remove <literal-path>` and `git branch -d <branch>` immediately after merge), and UI/UX assistant rules.

## Mandatory Rule: Environment-Driven Selections & Feature Flags
All configurable selections, feature flags (`VITE_AREA_BOARD_ENABLED`, `VITE_LIFE_READING_ENABLED`, `VITE_LUCKY_TIMES_ENABLED`), API base URLs, and runtime thresholds must be read from environment variables with clean defaults rather than hardcoded in component logic.

## Deploying `develop` via `release-candidate-staging` & GitHub Actions
Once `tsc --noEmit` (`npm run build -- --mode staging` or typecheck) and tests pass on `develop`, Gemini agents are authorized to push `develop`, merge `develop` `--no-ff` into `release-candidate-staging`, and push `release-candidate-staging` (with `gh auth switch --user sachinm`) to trigger the GitHub Actions OIDC Amplify deployment (`d20sdo476h9w6c`).

## Mandatory Rule: Enterprise Security Headers & Client Error Telemetry
Follow [`enterprise-security-observability.md`](file:///c:/Users/Owner/Documents/work/AIAstra_Server/.agents/rules/enterprise-security-observability.md) across every web change:
- **Security Headers (`customHttp.yml`)**: Preserve `Content-Security-Policy` (keep inline script SHA-256 hashes in sync with `index.html`, `'wasm-unsafe-eval'` only for MediaPipe WASM, Turnstile & API origins only, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `report-uri /api/telemetry/csp-report`), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- **Error Boundary & Global Listeners (`src/App.tsx`, `src/components/GlobalErrorBoundary.tsx`, `src/lib/errorTelemetry.ts`)**: Keep application routes wrapped in `<GlobalErrorBoundary>` (never expose raw stack traces in UI) and keep `installGlobalErrorListeners()` mounted so `window.onerror`, `unhandledrejection`, and `securitypolicyviolation` events forward to `/api/telemetry/client-errors` (rate-limited + 60s deduplicated).
- **GraphQL `requestId` Correlation (`src/lib/graphql.ts`)**: Extract `X-Request-Id` and `extensions.requestId` / `extensions.code` on HTTP >= 500, tracked GraphQL error codes, and network/timeout errors without breaking auth/sign-out flows.
- **Zero PII in Error Reports**: Always scrub emails, `Bearer ...`, JWTs (`eyJ...`), `key=` secrets, and URL query strings via `redactClientErrorText` and origin+pathname CSP sanitization before sending telemetry.
