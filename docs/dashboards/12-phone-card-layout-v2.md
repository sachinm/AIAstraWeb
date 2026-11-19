# 12 · Phone card layout v2: header with the brand and the card title, three view bars, an always-there input

Written 2026-11-18 from Sachin's notes on the mock-up. Supersedes the phone parts of doc 09 and the "Chat is a third
face" part of doc 85 (the chat input is now always on the card; the three bars are Read, Analysis, Calendar).

## 1. Start (checked)

- Header (`TopNavigation.tsx`): menu button, logo, a board slot (doc 09), usage ring, notification bell, avatar menu.
  The card chips row and the next-card peek still sit in the board (`BoardV3.tsx`, `CardChips`, Carousel `peek`).
- A card (`CardFrame.tsx`) shows Read / Short as a switch, then its text; card chat (doc 85) is a third face with its
  own input; the old Calendar / Table / Breakdown tool panels were removed in the foundation release (doc 79), their
  feature keys are off.
- The card payload already carries what the new views need: `periods`, `keyDates`, `rail`, `standing`, `v3` spans,
  `agreement`, and the Oracle details (`ChartDetails`).

## 2. End goal (phone, under 768 px)

- **Header, one thin row:** left, the logo and the product name **AdAstraAI** (enough width; never clipped); middle,
  the **card title** with `▾` and `3/11` (tap: toggles the pull-down strip of card titles, §3a; the "All cards" grid sheet was dropped); right,
  **Messages**, **Bell**, **General Reading chat bubble** (carries the questions-left count the usage ring showed) and
  the **avatar**. The avatar opens a **full-screen menu**: dashboards (the person's chosen ones), profile, personalize,
  plans and usage, settings, sign out. The side menu button goes; the full-screen menu is the navigation.
- **Pull down for the titles (Sachin, 2026-11-18):** pulling down on the card (only when the card's own scroll is at
  the top) reveals a strip of card **titles only** under the header. A title can be tapped, or the strip swiped or
  dragged left and right; the selected title is the card on screen and the card follows live. Swiping the cards left
  and right keeps working and moves the strip's selection too. The strip collapses on selection, on pulling back up,
  or after a few seconds. This replaces the "All cards" grid from the header title; the header title only shows the
  current card name and `n/11`.
- **Under the header:** a thin 4 px progress strip (one tick per card).
- **The card:** full width, **no side peek**, swipe left/right between cards; page never scrolls; the card's text
  scrolls **inside** it (`overscroll-behavior: contain`).
- **Three wide bars across the card top:** **Read** · **Analysis** · **Calendar**. Read = the card's reading (the
  headline, one step, then the rest on scroll; the old Short is the top of Read). Analysis = why we think so: the
  chart details, the agreeing and testing systems, the ladder. Calendar = the card's dated windows and key dates as a
  month calendar plus the list (dates come from the Oracle and Personalizer as stored; none computed in the app).
- **Input:** a thin one-line textarea (mic and send inside it) **always anchored to the card's bottom**, above the
  phone keyboard. Typing starts the card's conversation: the first question goes through Clarify (doc 85, decided
  2026-11-18), answers stream into the card over the current view with a "Back to card" chip; the conversation stays
  on the card. The card's own text is the preamble.
- Tablet and desktop keep the current board; the three bars and the anchored input apply there too where they fit.

## 3. Deliverable (web only; no server change)

`TopNavigation.tsx` (brand left, board slot middle, icons right, usage count onto the chat bubble), new full-screen
`ProfileMenuSheet` (replaces the dropdown on phone, hosts dashboard navigation from `portalDashboards`),
`BoardV3.tsx` + `CardChips` (chips row gone on phone; header title toggles the title strip, §3a), Carousel (`peek` off on
phone, progress strip), `CardFrame.tsx` (three bars, scroll container with `overscroll-contain`), new `AnalysisView`
and `CalendarView` (read `card.periods`, `keyDates`, `rail`, details), `components/cardChat/*` (input anchored on the
card, conversation overlay with back chip; keep the clarifier path), tests, and doc 85 note.

## 3a. Owner addition (2026-11-18): pull down for the card titles

Replaces the header title's "All cards" grid sheet (`AllCardsSheet` is not built).

- **Pulling the card down** reveals a strip of the card **titles only** (no art, no chips) that slides down under the
  header, above the cards. The pull starts only when the card's own scroll is at its very top (`scrollTop` 0), so it
  never fights the card's text. A drag past **48 px** opens it; while dragging the strip follows the finger with a
  rubber band (half the travel, at most 56 px) and then snaps open or closed.
- The strip scrolls sideways with scroll-snap; the **title in the middle is the card on screen**, and the card below
  follows it live while the strip is scrolled. A tap on a title picks that card. Swiping the cards moves the strip's
  selection too (both ways in sync). The active title is highlighted; every title is a 44 px target.
- The strip **collapses** when a title is tapped, when the card is pushed back up past 48 px, after **4 s** idle, and
  when a conversation, the picker or Edit takes over.
- The header title shows the card on screen and `n/N`; tapping it toggles the same strip.
- The board's own controls (lens on Love/Work, the reading details, Edit, Add a card, the gear) open in the board sheet
  from the strip's last chip. The chips row shows on a phone only while editing the deck or after a failed save.
- Works with the 4 px progress ticks (one per card, the card on screen lit) under the header. Page pull-to-refresh
  stays off (`app-frame` locks `html`/`body` with `overscroll-behavior: none`). `prefers-reduced-motion` turns off the
  strip's slide and the centring scroll's animation.

## 3b. As built (web, `feat/phone-card-v2`)

- **Header (under 768 px):** logo + **AdAstraAI** left (`shrink-0`, never truncated), the board slot in the middle
  (card title, `n/N`), then Messages, Bell, the General Reading bubble (questions left; none for exempt or unlimited,
  red 0 when used up) and the avatar. The usage ring stays from 768 px. The side-menu button is gone except on the chat
  page, whose drawer holds the conversation list.
- **Messages vs Bell:** the app has one inbox (`NotificationBell`, `/api/notifications`). Messages is that same inbox
  filtered to `category: admin_message` (messages from AdAstra), with no unread count or poll of its own (the server's
  unread count covers every category). The Bell stays the whole inbox.
- **Avatar:** `ProfileMenuSheet`, full screen, portalled to `body`: the chosen dashboards (same names as the side menu,
  Happy Hour(s) included), General Reading, Profile, Personalize, Plan and usage (with questions left), Upgrade,
  Settings, Log out. Tablet and desktop keep the dropdown.
- **Card:** three bars (Read · Analysis · Calendar) on every template; Read starts with "What to do" (the old Short);
  the gear no longer offers a face. The sideways swipe inside a card no longer changes the period (it moves the cards).
- **Input:** `CardChat` stays mounted at the card's foot (`conversation` false = the thin input only, nothing opened).
  Focus, typing or the mic opens the conversation over the card's view in the same textarea node; Send from the idle
  input only opens it, so the cost line is on screen before any question is sent. The clarifier and the card-chat API
  are unchanged.

## 4–9. Architecture, steps, phases, recommendation

Steps: header → progress strip and no peek → three bars with Analysis and Calendar views → anchored input and
conversation overlay → full-screen profile menu → tests → release. One phase; verify with a phone screenshot. Chosen
design: the header carries the brand, the card title and the four actions so the card gets the whole screen; the
three bars replace Read/Short/Chat; the input is always there so asking is one tap.
