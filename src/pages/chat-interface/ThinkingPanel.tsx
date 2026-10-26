import React, { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ThinkingPanelProps {
  /** Thought summaries streamed so far (event `thought`). */
  text: string;
  /** The answer text has started (or the reply is finished). */
  answering: boolean;
  /** The reply is still being produced. */
  working: boolean;
}

/**
 * The model's thought summaries. Open while the answer is being prepared, collapsed once the answer starts.
 * A click on the header overrides that and keeps the panel as the user left it.
 */
const ThinkingPanel: React.FC<ThinkingPanelProps> = ({ text, answering, working }) => {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const bodyId = useId();
  if (!text.trim()) return null;

  const preparing = working && !answering;
  const open = userOpen ?? preparing;

  return (
    <div
      className="not-prose rounded-lg border border-purple-400/20 bg-white/5"
      data-test-id="thinking-panel"
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        data-test-id="thinking-toggle"
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-purple-200 hover:text-purple-100"
      >
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        <span className={preparing ? 'animate-pulse' : undefined}>{preparing ? 'Thinking…' : 'Thinking'}</span>
      </button>
      {open && (
        <div
          id={bodyId}
          data-test-id="thinking-body"
          className="max-h-48 overflow-y-auto px-3 pb-2 text-xs leading-relaxed text-gray-300 [&_p]:my-1 [&_strong]:text-gray-200"
        >
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default ThinkingPanel;
