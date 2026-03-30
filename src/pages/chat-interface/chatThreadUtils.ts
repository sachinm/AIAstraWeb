import type { Chat, Message as ApiMessage } from './chatAPI';
import { formatChatTimestamp, formatMessageTime } from './chatDateFormat';

export const MAX_SIDEBAR_CHATS = 15;

export const WELCOME_TEXT_INITIAL =
  "Namaste ! I'm your Vedic astrology guide, trained in ancient wisdom and cosmic insights. How can I illuminate your path today?";

export const WELCOME_TEXT_NEW_THREAD =
  "Namaste ! I'm your Vedic astrology guide. How can I help you with this new conversation?";

export interface UiMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: string;
}

export interface SidebarChatRow {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
}

export function chatToSidebarRow(chat: Chat): SidebarChatRow {
  const name = (chat.name ?? '').trim() || 'Conversation';
  return {
    id: chat.id,
    name,
    lastMessage: 'Tap to continue',
    timestamp: formatChatTimestamp(chat.created_at),
  };
}

export function snippetFromQuestion(q: string | null | undefined): string {
  const s = (q ?? '').trim();
  if (!s) return 'Tap to continue';
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

export function mapApiMessagesToUi(rows: ApiMessage[] | null | undefined): UiMessage[] {
  if (!rows?.length) {
    return [
      {
        id: '1',
        text: WELCOME_TEXT_INITIAL,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  }
  const out: UiMessage[] = [];
  for (const row of rows) {
    const ts = formatMessageTime(row.created_at);
    out.push({
      id: `${row.id}-u`,
      text: row.question ?? '',
      sender: 'user',
      timestamp: ts,
    });
    out.push({
      id: `${row.id}-a`,
      text: row.ai_answer ?? '',
      sender: 'ai',
      timestamp: ts,
    });
  }
  return out;
}
