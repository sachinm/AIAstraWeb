# Plan: one Profile section, a tiny menu, and a test suite that tells the truth (2026-11-02)

Asked by Sachin on 2026-11-02. Three parts, built in this order: A (Profile section), B (test health), C (staging freeze rule).

## Start: facts checked

- The avatar menu (`src/components/ProfileMenu.tsx`) lists ten items: Upgrade plan, Chat, Charts, Remedies, Mantras/Horoscope, Profile, Plan and usage, Life timeline, Settings, Log out. It is tall (about 1,100 px on a phone) and mixes places to go with account actions.
- A profile area already exists: `src/pages/profile/ProfileLayout.tsx` with four tabs (Details `/profile`, Plan `/profile/plan`, Life timeline `/profile/timeline`, Settings `/profile/settings`), wired in `src/routes.tsx`. The tabs sit at the top of the page, inside the app header.
- The in-app header (`src/pages/TopNavigation.tsx`) now runs full width: logo left, usage bar, avatar right (fixed 2026-11-02).
- The web suite shows 35 failures (11 of 16 files) in `src/components` and `src/pages/chat-interface` on unchanged `develop`, in my linked-`node_modules` setup. One of them, `LoadError.test.tsx`, uses no plan code at all, so the cause is not the `usePlan` mock I first guessed. I have not run the suite in a clean install. The web repo has no test workflow in CI; only the staging deploy runs.
- Staging serves the public site (`vedic-astrology.app`), so every push to `release-candidate-staging` is public. A "freeze" was declared for the demo; it has been broken five times on 2026-11-02, each time on Sachin's direct report.

## End goal

1. One place for everything about the person's account, reachable in one click, with a menu that is tiny.
2. A test suite whose red means broken and green means safe, run on every push.
3. A rule for staging pushes that matches how the work is actually done.

## Deliverable

### A. Profile section
- **Avatar menu (tiny):** name and plan line, then four rows: Chat, Profile, Upgrade plan (only when it applies), Log out. No more than five rows in total.
- **Profile section** at `/profile/*` with a left menu on desktop and a top sub-header on a phone, holding: Details, Plan and usage, Life timeline, Charts, Remedies, Mantras/Horoscope, Settings. Chat stays outside it.
- Header unchanged: logo anchored left, avatar right.

### B. Test health
- A `Tests` GitHub workflow in the web repo: `npm ci`, `npm run typecheck`, `vitest run`, on every push except `release-candidate-staging` and on pull requests (the same shape as the Radha one).
- All 35 failures explained and either fixed or deleted with a reason. The suite is green, or red only for a named, filed reason.

### C. Staging rule
- Written in `AGENTS.md`: a push to `release-candidate-staging` needs the Tests workflow green on the same commit, and a demo freeze names who may break it and how (Sachin's direct request in the deploy session).

## How it works when done

- **Backend/API:** no change. The menu reads the same `me` and plan data it reads today.
- **Frontend:** `ProfileMenu.tsx` shrinks to five rows. `ProfileLayout.tsx` becomes a two-column layout (left menu, content) with a top scroll-row under 768 px. Charts, Remedies and Mantras/Horoscope move under `/profile/...`; their old URLs redirect, as `/dashboard/chart` already does.
- **UI/UX:** one click on the avatar opens a short menu; "Profile" opens the section with every account page one click away; the browser's Back button and deep links keep working because each page is a route.

## Architecture

Routes only; no new state. `ProfileLayout` owns the menu list (one array drives both the left menu and the phone row). `ProfileMenu` imports the few rows it needs. Redirects live in `routes.tsx`.

## Ingredients

`ProfileMenu.tsx`, `ProfileLayout.tsx`, `routes.tsx`, the i18n strings (`menu.*`, `profile.tab*`), the existing page components, and a new `.github/workflows/tests.yml` for the web repo.

## Action steps, in order

1. Run the web suite once in a clean install (a GitHub Actions run, not this machine) and record the real failure list.
2. Add `tests.yml` to the web repo; push on a branch; read the result.
3. Fix or remove each failing test with a one-line reason; keep the commit separate from the feature.
4. Write the menu list once (array) and make the left menu and phone row read it.
5. Build the new `ProfileLayout`; move Charts, Remedies and Mantras/Horoscope under `/profile`; add redirects.
6. Shrink `ProfileMenu` to five rows; update its tests.
7. Check on a 375 px phone, a laptop and a wide screen; fix overflow.
8. Add the staging rule to `AGENTS.md`.

## Phases

1. **Test truth** (steps 1-3): half a day. Nothing user-visible.
2. **Profile section** (steps 4-7): one day, behind a branch, shown to Sachin on staging before the demo.
3. **Rule** (step 8): ten minutes.

## Recommendation

Do phase 1 first, because the new layout touches many tested components and today a failing test cannot be told from a real break. Then phase 2 in one change, not piecemeal. Do not push phase 2 to staging before the demo unless Sachin asks; the current menu works.
