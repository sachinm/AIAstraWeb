/**
 * Fires when the user sends a chat question from the dashboard chat UI. Sends the length only: a question can hold health,
 * money or family details, which must not go to Google Analytics.
 */
export function trackChatQuestionSent(rawText: string): void {
  const text = rawText.trim();
  if (!text || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  window.gtag('event', 'chat_question_sent', { question_length: text.length });
}
