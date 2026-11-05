/** Conversation categories (server docs/reading-engine/51 §4). General Reading first; the boards follow. */
export const CATEGORY_ORDER = ['general', 'today', 'you', 'love', 'work', 'lucky'];

export const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  today: 'Today',
  you: 'You',
  love: 'Love',
  work: 'Work',
  lucky: 'Happy Hour(s) (Panchang)',
};

/** The reading subject a board's questions are specialised to (a server FRAMES subject id). */
export const CATEGORY_FOCUS: Record<string, string | undefined> = {
  general: undefined,
  today: 'time_window_outlook',
  you: 'spirituality_direction',
  love: 'love_relationships',
  work: 'career_job',
  lucky: 'time_window_outlook',
};

export const CATEGORY_PLACEHOLDER: Record<string, string> = {
  general: 'Ask about work, money, relationships, timing…',
  today: 'Ask about today or this month…',
  you: 'Ask about yourself…',
  love: 'Ask about love and relationships…',
  work: 'Ask about your work map…',
  lucky: 'Ask about a good time for something…',
};
