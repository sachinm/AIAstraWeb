import type { Page, Route } from '@playwright/test';

/** A stand-in for the server. Pages that need an operation listed in `unhandled` show their empty state in the walkthrough. */
export interface StubState {
  used: number;
  limit: number;
  planCode: string;
  /** IP country the stub reports */
  country: 'US' | 'IN';
  messages: number;
  /** the account's research flag */
  research: boolean;
  /** false shows the birth details page */
  profileComplete: boolean;
  unhandled: Set<string>;
}

export const newState = (over: Partial<StubState> = {}): StubState => ({
  used: 2,
  limit: 20,
  planCode: 'free',
  country: 'US',
  messages: 2,
  research: false,
  profileComplete: true,
  unhandled: new Set(),
  ...over,
});

const plan = (s: StubState) => ({
  code: s.planCode,
  desired_plan: 'free',
  desired_interval: null,
  is_paid: s.planCode !== 'free',
  interval: null,
  used: s.used,
  limit: s.limit,
  remaining: Math.max(s.limit - s.used, 0),
  window: 'month',
  resets_at: '2026-12-01T00:00:00.000Z',
  exempt: false,
});

const ANSWER =
  '**Your next six months favour steady work over a sudden change.** The current period supports building on what you already do. ' +
  'A short window in late January looks stronger for a new role, with a slower stretch through March.\n\n' +
  '- Strongest window: 20 January to 10 February 2027\n- Slower stretch: March 2027\n\n' +
  'This reading comes from your own chart and the periods running now.';

const chart = {
  status: 'ready',
  stage: null,
  gate_done: 10,
  gate_total: 10,
  rest_done: 100,
  rest_total: 100,
  facts_status: 'ready',
  reading_mode: 'full',
  last_error: null,
};

function graphql(s: StubState, op: string, variables: Record<string, unknown>): Record<string, unknown> | null {
  const chatRow = { id: 'c1', user_id: 'u1', name: 'Will I change jobs this year?', is_active: true, created_at: '2026-11-01T10:00:00Z' };
  switch (op) {
    case 'StartupHealthCheck':
      return { __typename: 'Query' };
    case 'Me':
      return { me: { profile_complete: s.profileComplete, email_verified: true, kundli_status: 'ready', chart } };
    case 'MeDetails':
      return { meDetails: { user_id: 'u1', is_active: true, kundli_added: true, queue_status: 'completed' } };
    case 'MyPlan':
      return { me: { language: 'en', plan: plan(s) } };
    case 'MyPlanBreakdown':
      return { me: { plan: { breakdown: { chat: s.used, cardchat: 0, board_refresh: 0, other: 0 } } } };
    case 'MyProfile':
      return {
        me: {
          name: 'Test Person', email: 'test.person@example.com', gender: 'prefer_not_to_say', date_of_birth: '1990-04-27',
          time_of_birth: '10:30', country_code: 'US', city: 'San Jose', language: 'en', kundli_status: 'ready', chart,
        },
      };
    case 'Chats':
      return {
        chats: {
          success: true,
          error: null,
          chats: [chatRow, { ...chatRow, id: 'c2', name: 'What about my finances next year?', is_active: false }],
        },
      };
    case 'ActiveChat':
      return { activeChat: { success: true, error: null, chat: chatRow } };
    case 'ChatMessages':
      return {
        chatMessages: {
          success: true,
          error: null,
          messages: Array.from({ length: s.messages }, (_, i) => ({
            id: `m${i}`,
            chat_id: String(variables.chatId ?? 'c1'),
            question: `Question ${i + 1}: Will I change jobs this year?`,
            ai_answer: ANSWER,
            created_at: '2026-11-01T10:00:00Z',
          })),
        },
      };
    case 'MyKundliDisplayData': {
      const birth = { date: '1990-04-27', time: '10:30:00', place_name: 'San Jose, US', nakshatra: 'Hast (Mo) Quarter-4 21:29:55 (-1) from 23:40:41 ends' };
      const lagna = { body: 'Lagna', longitude: '20 Vi 12', nakshatra: 'Hast', pada: '4', rasi: 'Vi' };
      const sun = { body: 'Sun', longitude: '13 Ar 09', nakshatra: 'Asw', pada: '4', rasi: 'Ar' };
      const full = s.research ? JSON.stringify([lagna, sun]) : null;
      return {
        myKundliDisplayData: {
          success: true, error: null, research: s.research, biodata: JSON.stringify(birth),
          d1: JSON.stringify(s.research ? [lagna, sun] : [lagna]), d7: full, d9: full, d10: full, vimsottari_dasa: null, narayana_dasa: null,
        },
      };
    }
    case 'CreateChat':
      return { createChat: { success: true, error: null, chat: { ...chatRow, id: 'c3', name: null } } };
    case 'CompleteProfile':
      return { completeProfile: { success: true, message: 'Saved', referral_code: 'ABCD2345' } };
    case 'Logout':
      return { logout: { success: true } };
    default:
      return null;
  }
}

function plansBody(s: StubState, url: URL) {
  const asked = url.searchParams.get('region');
  const region = asked === 'IN' || asked === 'US' ? asked : s.country;
  const currency = region === 'IN' ? 'INR' : 'USD';
  const price = (usd: number, inr: number) => (currency === 'INR' ? inr : usd);
  const prices = (m: number, y: number) => ({ month: { amount_minor: m, currency }, year: { amount_minor: y, currency } });
  return {
    country: s.country,
    region,
    currency,
    gateway: null,
    plans: [
      { code: 'free', name: 'Free', limit: 20, window: 'month', prices: null },
      { code: 'plus', name: 'Plus', limit: 100, window: 'month', prices: prices(price(5_000, 249_900), price(50_000, 2_499_900)) },
      { code: 'unlimited', name: 'Unlimited', limit: null, window: 'month', prices: prices(price(20_000, 999_900), price(200_000, 9_999_900)) },
    ],
  };
}

function sse(events: unknown[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

/** Stubs every API path on the page's own origin. */
export async function stubApi(page: Page, s: StubState): Promise<void> {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query?: string; variables?: Record<string, unknown> };
    const op = /(?:query|mutation)\s+([A-Za-z]+)/.exec(body.query ?? '')?.[1] ?? 'anonymous';
    const data = graphql(s, op, body.variables ?? {});
    if (!data) s.unhandled.add(op);
    return json(route, { data: data ?? {} });
  });
  await page.route('**/api/billing/plans*', (route) => json(route, plansBody(s, new URL(route.request().url()))));
  await page.route('**/api/billing/checkout', (route) => json(route, { status: 'pending_payment', checkout_url: null, plan: plan(s) }));
  await page.route('**/api/chat/ask-stream', async (route) => {
    if (s.used >= s.limit) return json(route, { error: 'Question limit reached', code: 'quota_exhausted', usage: plan(s) }, 402);
    s.used += 1;
    s.messages += 1;
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sse([
        { type: 'start' },
        { type: 'usage', usage: plan(s) },
        { type: 'token', delta: ANSWER },
        { type: 'done', chatId: 'c1', answer: ANSWER, usage: plan(s) },
      ]),
    });
  });
}

/** A signed-in browser: an unsigned token that the client reads only for its expiry. */
export async function signIn(page: Page): Promise<void> {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${b64({ alg: 'none' })}.${b64({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 86_400 })}.x`;
  const user = { name: 'Test Person', email: 'test.person@example.com', dateOfBirth: '1990-04-27', placeOfBirth: 'San Jose,US', timeOfBirth: '10:30' };
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('token', t as string);
      localStorage.setItem('userId', 'u1');
      localStorage.setItem('astroUser', u as string);
      sessionStorage.setItem('lastActivityAt', String(Date.now()));
    },
    [token, JSON.stringify(user)]
  );
}
