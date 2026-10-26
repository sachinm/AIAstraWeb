// UserData – GraphQL for most APIs; chat may use REST SSE when VITE_CHAT_STREAM is enabled.
import { runGraphQL, getUserId } from '../lib/graphql';
import { buildApiHeaders } from '../lib/apiHeaders';
import type { ReadingStreamEvent } from './chat-interface/readingProgress';

/**
 * Server `ask` runs LLM; short client timeouts abort while the server may still succeed.
 * Default 15m. Set VITE_GRAPHQL_ASK_TIMEOUT_MS=0 to disable browser-side timeout only.
 */
function getAskQueryTimeoutMs(): number {
  const raw = import.meta.env.VITE_GRAPHQL_ASK_TIMEOUT_MS;
  if (raw != null && String(raw).trim() !== '') {
    const s = String(raw).trim();
    if (s === '0') return 0;
    const n = Number(s);
    if (Number.isFinite(n) && n >= 60_000) return Math.min(Math.floor(n), 1_800_000);
  }
  return 900_000;
}

/**
 * When true (default): `POST /api/chat/ask-stream` streams `{type:"token",delta}` and the UI updates incrementally.
 * When false (`VITE_CHAT_STREAM` = `0` / `false` / `off`): GraphQL `ask` only — the full answer appears once when the server finishes (often 30s+ for long Gemini calls).
 */
/** Ask the server to clarify vague questions (clarify agent). VITE_CHAT_CLARIFY=0 turns it off. */
export function isClarifyEnabled(): boolean {
  const raw = String(import.meta.env.VITE_CHAT_CLARIFY ?? '1').trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off');
}

export function isChatStreamEnabled(): boolean {
  const raw = import.meta.env.VITE_CHAT_STREAM || '1';
  if (raw == null || String(raw).trim() === '') return true;
  const s = String(raw).trim().toLowerCase();
  if (s === '0' || s === 'false' || s === 'off') return false;
  return true;
}

/** Builds absolute URL for SSE chat. Used only when {@link isChatStreamEnabled} is true. */
function getChatAskStreamUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_GRAPHQL_BASE;
  if (apiBase) {
    return `${apiBase.replace(/\/+$/, '')}/api/chat/ask-stream`;
  }
  const ep = import.meta.env.VITE_GRAPHQL_ENDPOINT || '/graphql';
  if (ep.startsWith('http://') || ep.startsWith('https://')) {
    try {
      return `${new URL(ep).origin}/api/chat/ask-stream`;
    } catch {
      return '/api/chat/ask-stream';
    }
  }
  return '/api/chat/ask-stream';
}

async function consumeChatAskSse(
  response: Response,
  onToken: (delta: string) => void,
  onEvent?: (event: ReadingStreamEvent) => void
): Promise<StreamResult> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let chatId = '';
  let clarifyingRunId = '';

  const processEventBlock = (block: string) => {
    for (const line of block.split('\n')) {
      const t = line.trimEnd();
      if (!t.startsWith('data:')) continue;
      const raw = t.slice(5).trimStart();
      if (!raw || raw === '[DONE]') continue;
      let ev: { type?: string; delta?: string; chatId?: string; answer?: string; message?: string; [k: string]: unknown };
      try {
        ev = JSON.parse(raw) as typeof ev;
      } catch {
        continue;
      }
      if (ev.type === 'token' && typeof ev.delta === 'string') {
        onToken(ev.delta);
        answer += ev.delta;
      } else if (ev.type === 'start') {
        /* server opened stream; no UI action */
      } else if (ev.type === 'done') {
        if (typeof ev.answer === 'string') answer = ev.answer;
        if (typeof ev.chatId === 'string') chatId = ev.chatId;
        // the clarify agent asked a question instead of answering; the reading follows after confirm
        if (ev.status === 'clarifying' && typeof ev.runId === 'string') clarifyingRunId = ev.runId;
      } else if (ev.type === 'error') {
        throw new Error(ev.message || 'Stream error');
      } else if (ev.type === 'intent' || ev.type === 'stage' || ev.type === 'windows' || ev.type === 'info' || ev.type === 'clarify' || ev.type === 'propose' || ev.type === 'thought' || ev.type === 'next') {
        // reading-engine progress; older servers never send these
        onEvent?.(ev as ReadingStreamEvent);
      }
    }
  };

  const flushBuffer = () => {
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      processEventBlock(event);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        flushBuffer();
      }
      if (done) {
        buffer += decoder.decode();
        flushBuffer();
        if (buffer.trim()) processEventBlock(buffer);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (clarifyingRunId) return { answer: '', chatId: '', clarifyingRunId };
  if (!chatId) throw new Error('Stream ended without completion');
  return { answer, chatId };
}

export interface StreamResult {
  answer: string;
  chatId: string;
  /** set when the server asked a clarifying question instead of answering (clarify agent) */
  clarifyingRunId?: string;
}

/** Where a question is asked: lat/lon rounded to 2 decimals in the client, tz an IANA zone. */
export interface QuestionLocationFields {
  lat: number;
  lon: number;
  tz?: string;
}

/** Body fields for ask-stream / confirm-stream; empty when there is no usable location (server falls back to birth place). */
export function locationFields(location: QuestionLocationFields | null | undefined): Partial<QuestionLocationFields> {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return {};
  return { lat: location.lat, lon: location.lon, ...(location.tz ? { tz: location.tz } : {}) };
}

/**
 * Token-streaming chat (SSE). Same persistence as GraphQL `ask`; updates UI via `onDelta`.
 */
export const sendChatMessageStream = async (
  question: string,
  chatId: string | null | undefined,
  onDelta: (delta: string) => void,
  options?: {
    signal?: AbortSignal;
    onEvent?: (event: ReadingStreamEvent) => void;
    clarify?: boolean;
    /** Answer one part of a multi-part question (after a `next` event); `parts` are the ones still to come after it. */
    focus?: { subject: string; parts: string[] };
    /** Where the question is asked (prashna chart); omitted means the server uses the birth place. */
    location?: QuestionLocationFields | null;
  }
): Promise<StreamResult> => {
  return postChatSse(
    getChatAskStreamUrl(),
    {
      question,
      chatId: chatId ?? null,
      ...(options?.clarify ? { clarify: true } : {}),
      ...(options?.focus ? { focus: options.focus.subject, parts: options.focus.parts } : {}),
      ...locationFields(options?.location),
    },
    onDelta,
    options
  );
};

/** Confirms the clarified question and streams the reading (clarify agent). */
export const confirmClarifyStream = async (
  runId: string,
  chatId: string | null | undefined,
  onDelta: (delta: string) => void,
  options?: {
    signal?: AbortSignal;
    onEvent?: (event: ReadingStreamEvent) => void;
    edits?: { horizon?: string; bucket?: string };
    location?: QuestionLocationFields | null;
  }
): Promise<StreamResult> => {
  return postChatSse(
    chatApiUrl('/api/chat/confirm-stream'),
    { runId, chatId: chatId ?? null, ...(options?.edits ? { edits: options.edits } : {}), ...locationFields(options?.location) },
    onDelta,
    options
  );
};

export type ClarifyAnswerResult =
  | { type: 'clarify'; runId: string; criterion: string; question: string; chips: Array<{ label: string; value: string }>; allowFreeText: boolean; guidance?: string; understanding?: string }
  | { type: 'propose'; runId: string; exactQuery: string; assumed: string | null }
  | { type: 'declined'; runId: string; reply: string }
  | { type: 'ready'; runId: string };

/**
 * Sends a chip or typed answer to the clarify agent; returns its next step. `tz` (the browser's IANA timezone) goes
 * with the answer to "Where are you living now?" so timing can be stated in local terms.
 */
export const answerClarify = async (runId: string, value: string, viaChip: boolean, options?: { tz?: string }): Promise<ClarifyAnswerResult> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) throw new Error('Not authenticated');
  const body = JSON.stringify({ runId, value, viaChip, ...(options?.tz ? { tz: options.tz } : {}) });
  const headers = await buildApiHeaders({ token, body, method: 'POST' });
  const res = await fetch(chatApiUrl('/api/chat/answer'), { method: 'POST', headers, body });
  if (res.status === 401) throw new Error('Not authenticated');
  if (!res.ok) throw new Error(`Clarify failed (${res.status})`);
  return (await res.json()) as ClarifyAnswerResult;
};

function chatApiUrl(path: string): string {
  const ask = getChatAskStreamUrl();
  return ask.replace(/\/api\/chat\/ask-stream$/, path);
}

async function postChatSse(
  url: string,
  payload: Record<string, unknown>,
  onDelta: (delta: string) => void,
  options?: { signal?: AbortSignal; onEvent?: (event: ReadingStreamEvent) => void }
): Promise<StreamResult> {
  // No `meDetails` round trip here: the chat input is only enabled once the kundli is ready (ChatSection polls it),
  // and the server re-checks on every ask-stream (400 "chart is still being prepared"). Skipping the extra call
  // removes one full network round trip before the first byte of every answer.
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) throw new Error('Not authenticated');

  const timeoutMs = getAskQueryTimeoutMs();
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
    timeoutId = setTimeout(() => {
      try {
        controller.abort(
          new DOMException(`Chat stream timed out after ${timeoutMs}ms`, 'TimeoutError')
        );
      } catch {
        controller.abort();
      }
    }, timeoutMs);
  }

  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const body = JSON.stringify(payload);
    const headers = await buildApiHeaders({ token, body, method: 'POST' });
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (res.status === 401) throw new Error('Not authenticated');
    if (res.status === 400) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || 'Bad request');
    }
    if (!res.ok) throw new Error(`Chat stream failed (${res.status})`);
    if (!res.body) throw new Error('Empty stream response');

    return await consumeChatAskSse(res, onDelta, options?.onEvent);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export interface UserDetailsResponse {
  success: boolean;
  user_id?: string;
  is_active?: boolean;
  kundli_added?: boolean;
  queue_status?: string | null;
  message?: string;
}

export interface BiodataResponse {
  success: boolean;
  username: string;
  biodata: {
    date?: string;
    time?: string;
    yoga?: string;
    place?: string;
    [key: string]: unknown;
  };
}

const MY_KUNDLI_DISPLAY_DATA = `
  query MyKundliDisplayData {
    myKundliDisplayData {
      success
      error
      biodata
      d1
      d7
      d9
      d10
      vimsottari_dasa
      narayana_dasa
    }
  }
`;
export interface KundliDisplayDataResponse {
  success: boolean;
  biodata: unknown | null;
  d1: unknown | null;
  d7: unknown | null;
  d9: unknown | null;
  d10: unknown | null;
  vimsottari_dasa: unknown | null;
  narayana_dasa: unknown | null;
  message?: string;
}

export interface UserContentResponse {
  success: boolean;
  data?: unknown;
  message?: string;
}

const ME_DETAILS = `
  query MeDetails {
    meDetails {
      user_id
      is_active
      kundli_added
      queue_status
    }
  }
`;

const MY_BIODATA = `
  query MyBiodata {
    myBiodata {
      success
      username
      biodata
      error
    }
  }
`;

const MY_CONTENT = `
  query MyContent {
    myContent {
      success
      content
      error
    }
  }
`;

const ASK_QUERY = `
  query Ask($question: String!, $chatId: ID) {
    ask(question: $question, chatId: $chatId) {
      success
      answer
      error
    }
  }
`;

const CREATE_CHAT_MUTATION = `
  mutation CreateChat {
    createChat {
      success
      chat { id }
      error
    }
  }
`;

export const fetchUserDetails = async (): Promise<UserDetailsResponse> => {
  const userId = getUserId();
  if (!userId) throw new Error('User ID not found');

  const { data, errors } = await runGraphQL<{
    meDetails: { user_id: string; is_active: boolean; kundli_added: boolean; queue_status: string | null } | null;
  }>(ME_DETAILS);
  if (errors?.length) throw new Error(errors[0].message || 'Failed to fetch user details');

  const me = data?.meDetails;
  if (!me) return { success: false, message: 'Not authenticated' };
  return {
    success: true,
    user_id: me.user_id,
    is_active: me.is_active,
    kundli_added: me.kundli_added,
    queue_status: me.queue_status ?? null,
  };
};

export const fetchUserBiodata = async (): Promise<BiodataResponse> => {
  const details = await fetchUserDetails();
  if (!details.success || !details.kundli_added) {
    throw new Error('Kundli not available, biodata cannot be fetched');
  }

  const { data, errors } = await runGraphQL<{ myBiodata: { success: boolean; username: string; biodata: string; error: string | null } }>(MY_BIODATA);
  if (errors?.length) throw new Error(errors[0].message || 'Failed to fetch biodata');

  const result = data?.myBiodata;
  if (!result?.success || result.error) throw new Error(result?.error || 'Invalid response');
  const biodata = typeof result.biodata === 'string' ? JSON.parse(result.biodata) : result.biodata;
  return { success: true, username: result.username ?? '', biodata };
};

/**
 * Creates a new chat thread for the current user. Backend marks it active and returns its id.
 * Call on login (to start a fresh thread) and when the user clicks "New conversation".
 */
export const createChat = async (): Promise<{ id: string }> => {
  const { data, errors } = await runGraphQL<{
    createChat: { success: boolean; chat: { id: string } | null; error: string | null };
  }>(CREATE_CHAT_MUTATION);
  if (errors?.length) throw new Error(errors[0].message || 'Failed to create chat');
  const result = data?.createChat;
  if (!result?.success || !result?.chat?.id) throw new Error(result?.error || 'Failed to create chat');
  return { id: result.chat.id };
};

/**
 * Sends a chat message in the given thread and returns the AI reply.
 * Pass chatId so the message is stored in that thread (reduces cross-thread hallucination).
 */
export const sendChatMessage = async (question: string, chatId?: string | null): Promise<string> => {
  const details = await fetchUserDetails();
  if (!details.success || !details.kundli_added) {
    throw new Error('Kundli not available, cannot start chat');
  }

  const { data, errors } = await runGraphQL<{ ask: { success: boolean; answer: string | null; error: string | null } }>(
    ASK_QUERY,
    { question, chatId: chatId || null },
    { timeoutMs: getAskQueryTimeoutMs() }
  );
  if (errors?.length) throw new Error('Request failed');

  const result = data?.ask;
  if (result?.success && result?.answer) return result.answer;
  throw new Error(result?.error || "I couldn't interpret the stars this time. Try again?");
};

export const fetchUserContent = async (): Promise<UserContentResponse> => {
  const details = await fetchUserDetails();
  if (!details.success || !details.kundli_added) {
    throw new Error('Kundli not available, content cannot be fetched');
  }

  const { data, errors } = await runGraphQL<{ myContent: { success: boolean; content: string | null; error: string | null } }>(MY_CONTENT);
  if (errors?.length) throw new Error(errors[0].message || 'Failed to fetch content');

  const result = data?.myContent;
  if (!result?.success || result.error) throw new Error(result?.error || 'Invalid response');
  const content = result.content ? JSON.parse(result.content) : null;
  return { success: true, data: content };
};

export const fetchKundliDisplayData = async (): Promise<KundliDisplayDataResponse> => {
  const details = await fetchUserDetails();
  if (!details.success) {
    throw new Error(details.message || 'Failed to fetch user details');
  }

  const { data, errors } = await runGraphQL<{
    myKundliDisplayData: {
      success: boolean;
      error: string | null;
      biodata: string | null;
      d1: string | null;
      d7: string | null;
      d9: string | null;
      d10: string | null;
      vimsottari_dasa: string | null;
      narayana_dasa: string | null;
    };
  }>(MY_KUNDLI_DISPLAY_DATA);

  if (errors?.length) throw new Error(errors[0].message || 'Failed to fetch Kundli display data');

  const result = data?.myKundliDisplayData;
  if (!result?.success) {
    throw new Error(result?.error || 'Invalid Kundli display response');
  }

  const safeParse = (value: string | null): unknown | null => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  return {
    success: true,
    biodata: safeParse(result.biodata),
    d1: safeParse(result.d1),
    d7: safeParse(result.d7),
    d9: safeParse(result.d9),
    d10: safeParse(result.d10),
    vimsottari_dasa: safeParse(result.vimsottari_dasa),
    narayana_dasa: safeParse(result.narayana_dasa),
  };
}
