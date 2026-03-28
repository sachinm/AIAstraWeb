// UserData – all via GraphQL (no internal API or Supabase details)
import { runGraphQL, getUserId } from '../lib/graphql';

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
