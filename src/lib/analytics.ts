/** GA4 caps custom parameter values at 500 characters. */
const GA4_MAX_PARAM_LENGTH = 500;

/**
 * Fires when the user sends a chat question from the dashboard chat UI.
 * Register `chat_question_sent` as a custom event in GA4 and mark `question_text` / `question_length`
 * as custom dimensions if you want them in standard reports.
 */
export function trackChatQuestionSent(rawText: string): void {
  const text = rawText.trim();
  if (!text || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  window.gtag('event', 'chat_question_sent', {
    question_length: text.length,
    question_text:
      text.length <= GA4_MAX_PARAM_LENGTH ? text : text.slice(0, GA4_MAX_PARAM_LENGTH),
  });
}
