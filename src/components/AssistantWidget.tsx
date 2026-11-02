import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ASSISTANT_MAX_CHARS, askAssistant, logVisit, type AssistantReply } from '../lib/assistantApi';
import { PRODUCT_NAME } from '../lib/legal';

const EXAMPLES = ['Can you tell me where my son will go to college?', 'What field am I more inclined for?', 'Can you answer questions about my illness?', 'Can you read my birth chart?'];
const FAILED = 'I could not answer just now. Please try again in a moment.';
const KEEP_TURNS = 3;

interface Turn {
  question: string;
  reply: AssistantReply | null;
}

/**
 * The guide on the public pages: says what the app can help with, and never gives a reading. Not shown on sign-in, or to
 * someone signed in (PublicFrame decides). Nothing is asked of the visitor until they open it.
 */
const AssistantWidget: React.FC = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void logVisit();
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [turns]);

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;
    setBusy(true);
    setText('');
    setTurns((t) => [...t, { question, reply: null }].slice(-KEEP_TURNS));
    let reply: AssistantReply;
    try {
      reply = await askAssistant(question);
    } catch {
      reply = { answer: FAILED, verdict: 'unsure', cta: false };
    }
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, reply } : x)));
    setBusy(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ask ${PRODUCT_NAME}`}
        data-test-id="assistant-open"
        className="fixed bottom-24 left-4 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/80 p-3 text-sm font-medium text-white shadow-2xl backdrop-blur hover:bg-slate-900 sm:left-6 sm:px-4"
      >
        <MessageCircle className="h-5 w-5 text-purple-300" aria-hidden="true" />
        {/* the icon alone on a phone, where the words would sit on the page's main button */}
        <span className="hidden sm:inline">Ask {PRODUCT_NAME}</span>
      </button>
    );
  }

  return (
    <section
      aria-label={`Ask ${PRODUCT_NAME}`}
      data-test-id="assistant-panel"
      className="fixed bottom-24 left-4 z-30 flex max-h-[65dvh] w-[min(calc(100vw-2rem),24rem)] flex-col rounded-2xl border border-white/20 bg-slate-950/95 text-white shadow-2xl backdrop-blur sm:left-6"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold">Ask what {PRODUCT_NAME} can do</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-gray-300 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
        {turns.length === 0 && (
          <div className="flex flex-col items-start gap-2">
            {EXAMPLES.map((q) => (
              <button key={q} type="button" onClick={() => void ask(q)} className="rounded-full border border-white/20 px-3 py-1.5 text-left text-xs text-purple-100 hover:bg-white/10">
                {q}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={`${i}-${t.question}`} className="space-y-2">
            <p className="ml-6 rounded-xl bg-purple-600/30 px-3 py-2">{t.question}</p>
            {t.reply ? (
              <div className="mr-6 rounded-xl bg-white/10 px-3 py-2" data-test-id="assistant-answer">
                <p>{t.reply.answer}</p>
                {t.reply.cta && pathname !== '/signup' && (
                  <Link to="/signup" className="mt-2 inline-block font-semibold text-purple-300 underline underline-offset-2 hover:text-purple-200">
                    Sign up and read your chart
                  </Link>
                )}
              </div>
            ) : (
              <p className="mr-6 rounded-xl bg-white/10 px-3 py-2 text-gray-300">Thinking...</p>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form
        className="border-t border-white/10 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={ASSISTANT_MAX_CHARS}
            placeholder="Ask a question"
            aria-label="Your question"
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="rounded-lg bg-purple-600 p-2 text-white hover:bg-purple-500 disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-gray-400">
          Not a reading. For education and entertainment. Questions are logged, see our <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </section>
  );
};

export default AssistantWidget;
