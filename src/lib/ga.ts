/**
 * Google Analytics 4 for what a person does in a session (Sachin, 2026-11-05). Every first-party `track()` event is
 * also sent here, so GA shows the clicks, the plans (scenarios) chosen, where and when, in its standard reports:
 *
 *  - choices and taps use GA's recommended `select_content` (content_type = surface:event, item_id = what was picked);
 *  - the rest keep their own names (`why_open`, `window_open`, ...), with `event_surface` and `event_target`;
 *  - every route change sends a `page_view` (the tag alone only sees the first page of a single-page app);
 *  - the signed-in person is a GA `user_id` (our internal id, never the email), and their plan a user property.
 *
 * Privacy line, the same as chat: never free text, never birth data, never an email or a name. The tag is set up with
 * ad signals and ad personalization off (index.html). GA's custom dimensions (event_surface, event_target, event_detail)
 * are registered once in the GA admin screen, and appear in reports from then on.
 */
import type { EventName } from './events';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type Props = Record<string, string | number | boolean>;

const SELECT_EVENTS = new Set<EventName>([
  'tab_select',
  'view_select',
  'week_select',
  'chip_select',
  'scenario_add',
  'scenario_remove',
  'scenario_layer_toggle',
  'scenario_answer',
  'place_set',
  'question_answer',
]);

function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag(...args);
  } catch {
    // analytics never breaks the page
  }
}

/** One click or choice, as GA sees it. `event_detail` carries the scalar props (which week, a count). */
export function gaEvent(event: EventName, surface: string, target?: string, props?: Props): void {
  if (event === 'page_view') return; // route changes send their own, with the path
  const params: Props = { event_surface: surface };
  if (target) params.event_target = target;
  if (props) {
    const detail = Object.entries(props).map(([k, v]) => `${k}=${String(v)}`).join('&').slice(0, 100);
    if (detail) params.event_detail = detail;
  }
  if (SELECT_EVENTS.has(event)) {
    gtag('event', 'select_content', { ...params, content_type: `${surface}:${event}`, item_id: target ?? event });
  } else {
    gtag('event', event, params);
  }
}

/** A route change in the single-page app. */
export function gaPageView(path: string, title?: string): void {
  gtag('event', 'page_view', {
    page_path: path,
    page_location: typeof window !== 'undefined' ? window.location.origin + path : path,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : undefined),
  });
}

/** Ties the session's events to one person (our internal id) and their plan; cleared when signed out. */
export function gaSetUser(userId: string | null, plan?: string | null): void {
  gtag('set', { user_id: userId ?? undefined });
  gtag('set', 'user_properties', { plan: plan ?? undefined });
}
