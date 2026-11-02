# Profile: details, plan, settings, life timeline

## Start (checked 2026-11-01)

`/profile` is one long page (`src/pages/profile/ProfileSection.tsx`): name, birth details and language, then "Your life timeline", which holds `PastLifeReadingSection` (only with `VITE_TIMELINE_ENABLED=true`) and `LedgerSection`. Plan details exist only as one line in the dropdown (`ProfileMenu.tsx`) and on `/pricing`. There are no settings. Log out is already the last item in the dropdown. In chat, `ChatRightSidebar.tsx` keeps a 40 px column on the right holding only a toggle icon, and that column stays when the panel is open.

## End goal

A person opens the avatar menu and goes straight to their details, plan, life timeline or settings. Each has its own page and link. Chat gives the 40 px back.

## Deliverable

- `src/pages/profile/`: `ProfileLayout`, `ProfilePlan`, `ProfileSettings`, `ProfileTimeline`, with tests.
- Routes `/profile`, `/profile/plan`, `/profile/settings`, `/profile/timeline`.
- `ProfileMenu` links; Log out stays last.
- `ChatRightSidebar` without the column.
- No migrations, env vars or server changes.

## How it works when done

**Backend.** Nothing changes. `updateProfile` already merges partial input, and a language-only save rebuilds no chart (`profileService.ts`).

**API.** `me.email` is added to `MyProfile`; the field already exists on `User`. Settings sends `updateProfile({ language })`. Plan reads `me.plan` through `usePlan`.

**Frontend.**
- Details: name and birth details, as today, without the language and timeline parts.
- Plan: plan name, usage bar, reset date, the plan they chose if it isn't active yet, and a link to `/pricing`.
- Life timeline: the past reading when the flag is on, a "coming soon" line when it is off, and the life events ledger.
- Settings: email (read only), language with its own Save, the region switch, legal links, and how to close the account.

**UI/UX.** Tabs read Details, Plan, Life timeline, Settings, and scroll sideways on phones. Plan with no data: "Plan details are not available right now." Account with no limit: "Your account has no question limit." Failed language save: the server's message, with the choice kept.

## Architecture

`Dashboard` (nav and footer) > `ProfileLayout` (tabs) > one tab page. All sit inside `ProfileGate`, so `usePlan` and `useRefreshMe` keep working. Each tab reads what it needs when it opens.

## Ingredients

Existing components only: `LanguageField`, `RegionSwitch`, `LegalLinks`, `PastLifeReadingSection`, `LedgerSection`. From Sachin, later: `VITE_TIMELINE_ENABLED` for staging, `VITE_SUPPORT_EMAIL`.

## Action steps

1. Remove the chat column. The toggle floats over the chat when closed and sits in the panel header when open.
2. Add the layout, the routes and the Plan, Settings and Timeline tabs. Move language and the timeline out of `ProfileSection`.
3. Add the menu links and strings in `src/i18n/en.ts`.
4. Add tests and walkthrough screenshots of each tab.

## Development phases

Phase 1 is steps 1 to 4, closed by unit tests, the build and the walkthrough. Phase 2 is account deletion from Settings, which the phone app requires (filed in server `docs/TODOS.md`), and real plan management once a gateway exists.

## Recommendation

Separate routes rather than tabs held in page state, so the menu, emails and the phone app can link straight to a tab.
