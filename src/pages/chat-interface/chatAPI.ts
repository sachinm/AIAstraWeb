/**
 * Chat API – all chat and messages go through the backend GraphQL API.
 * The frontend does not call any LLM or Groq service directly; the backend runs
 * LangGraph → LangChain (ChatGroq) → Groq for each user message.
 */
import { runGraphQL, getUserId } from '../../lib/graphql';

export const getUserIdFromStorage = (): string | null => getUserId();
export { getUserId };

export interface Chat {
  id: string;
  name: string | null;
  last_message?: string;
  created_at: string | null;
  is_active: boolean | null;
  user_id: string;
}

export interface Message {
  id: string;
  chat_id: string;
  question: string;
  ai_answer: string;
  created_at: string | null;
}

const CHATS_QUERY = `
  query Chats {
    chats {
      success
      chats { id user_id name is_active created_at }
      error
    }
  }
`;

const ACTIVE_CHAT_QUERY = `
  query ActiveChat {
    activeChat {
      success
      chat { id user_id name is_active created_at }
      error
    }
  }
`;

const CHAT_MESSAGES_QUERY = `
  query ChatMessages($chatId: ID!) {
    chatMessages(chatId: $chatId) {
      success
      messages { id chat_id question ai_answer created_at }
      error
    }
  }
`;

const CREATE_CHAT_MUTATION = `
  mutation CreateChat {
    createChat {
      success
      chat { id user_id name is_active created_at }
      error
    }
  }
`;

const SET_CHAT_INACTIVE_MUTATION = `
  mutation SetChatInactive($chatId: ID!) {
    setChatInactive(chatId: $chatId) {
      success
      chat { id user_id name is_active created_at }
      error
    }
  }
`;

const ADD_MESSAGE_MUTATION = `
  mutation AddMessage($chatId: ID!, $question: String!, $aiAnswer: String!) {
    addMessage(chatId: $chatId, question: $question, aiAnswer: $aiAnswer) {
      success
      message { id chat_id question ai_answer created_at }
      error
    }
  }
`;

export const fetchAllChats = async (): Promise<Chat[]> => {
  if (!getUserId()) return [];
  try {
    const { data, errors } = await runGraphQL<{ chats: { success: boolean; chats: Chat[]; error: string | null } }>(CHATS_QUERY);
    if (errors?.length || !data?.chats?.success) return [];
    return data.chats.chats ?? [];
  } catch {
    return [];
  }
};

export const createNewChat = async (): Promise<Chat | null> => {
  if (!getUserId()) return null;
  try {
    const { data, errors } = await runGraphQL<{ createChat: { success: boolean; chat: Chat | null; error: string | null } }>(CREATE_CHAT_MUTATION);
    if (errors?.length || !data?.createChat?.success) return null;
    return data.createChat.chat;
  } catch {
    return null;
  }
};

export const markChatInactive = async (chatId: string): Promise<Chat | null> => {
  try {
    const { data, errors } = await runGraphQL<{ setChatInactive: { success: boolean; chat: Chat | null; error: string | null } }>(
      SET_CHAT_INACTIVE_MUTATION,
      { chatId }
    );
    if (errors?.length || !data?.setChatInactive?.success) return null;
    return data.setChatInactive.chat;
  } catch {
    return null;
  }
};

export const fetchActiveChat = async (): Promise<Chat | null> => {
  if (!getUserId()) return null;
  try {
    const { data, errors } = await runGraphQL<{ activeChat: { success: boolean; chat: Chat | null; error: string | null } }>(ACTIVE_CHAT_QUERY);
    if (errors?.length || !data?.activeChat?.success) return null;
    return data.activeChat.chat;
  } catch {
    return null;
  }
};

export const addMessageToChat = async (
  chatId: string,
  question: string,
  aiAnswer: string
): Promise<Message | null> => {
  try {
    const { data, errors } = await runGraphQL<{ addMessage: { success: boolean; message: Message | null; error: string | null } }>(
      ADD_MESSAGE_MUTATION,
      { chatId, question, aiAnswer }
    );
    if (errors?.length || !data?.addMessage?.success) return null;
    return data.addMessage.message;
  } catch {
    return null;
  }
};

export const fetchChatMessages = async (chatId: string): Promise<Message[]> => {
  try {
    const { data, errors } = await runGraphQL<{ chatMessages: { success: boolean; messages: Message[]; error: string | null } }>(
      CHAT_MESSAGES_QUERY,
      { chatId }
    );
    if (errors?.length || !data?.chatMessages?.success) return [];
    return data.chatMessages.messages ?? [];
  } catch {
    return [];
  }
};
