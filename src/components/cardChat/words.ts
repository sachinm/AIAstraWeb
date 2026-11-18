/** Every word the card chat says that is not from the server (server docs/reading-engine/85 §4 UI/UX). No ids, no engine name. */
import type { CardChatProblem } from '../../lib/cardChatApi';

export const CARD_CHAT_WORDS = {
  bubble: (title: string) => `Ask about ${title}`,
  chat: 'Chat',
  fromCard: 'From your card:',
  more: 'More',
  less: 'Less',
  opening: 'Opening this card’s chat…',
  openFailed: 'This chat did not open.',
  retry: 'Retry',
  placeholder: 'Ask about this card…',
  send: 'Send',
  you: 'You',
  reading: 'Reading your chart…',
  stillReading: 'Still reading your chart…',
  sendFailed: 'That did not go through.',
  stopped: 'Stopped before the answer finished.',
  tryAgain: 'Try again',
  quota: 'You have used your questions for now. Your question is still in the box.',
  plans: 'See plans',
  micStart: 'Speak your question',
  micStop: 'Stop listening',
  micListening: 'Listening…',
  micUnavailable: 'Microphone unavailable',
  micUnsupportedReason: 'Voice typing does not work in this browser. Type instead.',
  micDenied: 'Microphone access denied; tap to try again',
  empty: 'Ask anything about this card and the period on screen.',
  question: 'Your question about this card',
};

export const PROBLEM_WORD: Record<CardChatProblem, string> = {
  auth: 'Your session ended. Sign in again to ask.',
  off: 'Chat is not available for this card.',
  not_ready: 'This card is still being read. Try again in a moment.',
  no_kundli: 'Add your birth details to ask about this card.',
  quota: 'You have used your questions for now.',
  failed: 'That did not go through.',
};
