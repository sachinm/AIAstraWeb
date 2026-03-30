import React from 'react';
import { Send, User, Sparkles, Star, Mic, Square, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShriGaneshAvatar } from '../../components/ShriGaneshAvatar';
import { askWaitMessage } from './chatWaitCopy';
import type { UiMessage } from './chatThreadUtils';

export interface ChatMainAreaProps {
  messages: UiMessage[];
  streamingMessageId: string | null;
  isTyping: boolean;
  askElapsedSec: number;
  historyLoading: boolean;
  inputText: string;
  setInputText: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  quickQuestions: string[];
  isListening: boolean;
  isSupported: boolean;
  permissionDenied: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  inputDisabled: boolean;
}

const ChatMainArea: React.FC<ChatMainAreaProps> = ({
  messages,
  streamingMessageId,
  isTyping,
  askElapsedSec,
  historyLoading,
  inputText,
  setInputText,
  onSend,
  onKeyDown,
  quickQuestions,
  isListening,
  isSupported,
  permissionDenied,
  onStartListening,
  onStopListening,
  inputDisabled,
}) => {
  const showQuickQuestions = messages.length <= 1 && !historyLoading;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-4 flex items-center">
        <div className="flex items-center space-x-3">
          <ShriGaneshAvatar />
          <div>
            <h2 className="text-lg font-semibold text-white">Cosmic AI Astrologer</h2>
            <p className="text-green-400 text-sm">Online • Ready to guide you</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {historyLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
            aria-busy="true"
            aria-live="polite"
          >
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" aria-hidden />
          </div>
        )}
        {messages.map((message) =>
          message.sender === 'system' ? (
            <div key={message.id} className="py-2">
              <hr className="border-white/20 my-2" />
              <p className="text-center text-sm text-gray-400">{message.text}</p>
            </div>
          ) : (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-2 max-w-[70%] ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {message.sender === 'user' ? (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600">
                    <User className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <ShriGaneshAvatar className="h-8 w-8" />
                )}

                <div
                  className={`rounded-2xl p-4 ${
                    message.sender === 'user'
                      ? 'prose prose-invert max-w-none bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : message.id === streamingMessageId && !message.text.trim()
                        ? 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'
                        : 'prose prose-invert max-w-none bg-white/10 backdrop-blur-sm border border-white/20 text-white prose-p:mb-4 prose-p:mt-0 prose-headings:scroll-mt-4 prose-h2:mt-10 prose-h2:mb-3 prose-h3:mt-8 prose-h3:mb-2 prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-table:my-6 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-table:border-collapse prose-th:border prose-th:border-white/25 prose-td:border prose-td:border-white/15 prose-hr:my-8 prose-img:my-4'
                  }`}
                >
                  {message.sender === 'ai' ? (
                    message.id === streamingMessageId && !message.text.trim() ? (
                      <div className="not-prose flex flex-col gap-2" aria-live="polite">
                        <div className="flex space-x-2" aria-hidden>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                          <div
                            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.1s' }}
                          />
                          <div
                            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          />
                        </div>
                        <p className="text-sm text-gray-200 leading-snug">{askWaitMessage(askElapsedSec)}</p>
                      </div>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          img: ({ src, alt }) =>
                            typeof src === 'string' && src.startsWith('https://') ? (
                              <img
                                src={src}
                                alt={alt ?? ''}
                                className="max-h-64 max-w-full rounded-lg object-contain my-4 border border-white/20"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : null,
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                    )
                  ) : (
                    <p className="leading-relaxed">{message.text}</p>
                  )}
                  <p
                    className={`text-xs mt-2 ${
                      message.sender === 'user' ? 'text-blue-200' : 'text-gray-400'
                    }`}
                  >
                    {message.timestamp}
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {isTyping && !streamingMessageId && (
          <div className="flex justify-start" aria-busy="true" aria-live="polite">
            <div className="flex items-start space-x-2 max-w-[85%]">
              <ShriGaneshAvatar className="h-8 w-8" />
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 min-w-[12rem] max-w-[min(100%,24rem)]">
                <div className="flex flex-col gap-2">
                  <div className="flex space-x-2 flex-shrink-0" aria-hidden>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                  <p className="text-sm text-gray-200 leading-snug break-words">
                    {askWaitMessage(askElapsedSec)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showQuickQuestions && (
        <div className="px-4 pb-4">
          <h3 className="text-white font-medium mb-3 flex items-center">
            <Sparkles className="w-4 h-4 text-purple-400 mr-2" />
            Quick Questions to Get Started:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setInputText(question)}
                className="text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all duration-300 text-sm"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-black/30 backdrop-blur-md border-t border-white/10 p-4">
        {isListening && (
          <p className="text-xs text-purple-300 mb-2 flex items-center gap-1" aria-live="polite">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
            Listening...
          </p>
        )}
        <div className="flex items-end gap-4">
          <button
            type="button"
            onClick={onStartListening}
            disabled={!isSupported || inputDisabled || isListening}
            aria-label={
              !isSupported
                ? 'Microphone unavailable'
                : permissionDenied
                  ? 'Microphone access denied; click to try again'
                  : 'Start voice input'
            }
            title={
              !isSupported
                ? 'Voice input not supported in this browser'
                : permissionDenied
                  ? 'Microphone access denied; click to try again'
                  : 'Start voice input'
            }
            className="p-3 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shrink-0"
          >
            <Mic className="w-5 h-5" />
          </button>
          <div className="relative min-w-0 flex-1">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about your destiny, remedies, or any cosmic guidance..."
              className="w-full min-h-[4.5rem] max-h-60 resize-y overflow-y-auto bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white leading-relaxed placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              rows={3}
              disabled={inputDisabled}
            />
            <div className="pointer-events-none absolute right-3 top-3">
              <Star className="h-5 w-5 text-purple-400" />
            </div>
            {isListening && (
              <div className="absolute right-3 bottom-3">
                <button
                  type="button"
                  onClick={onStopListening}
                  aria-label="Stop listening"
                  className="p-2 rounded-lg bg-red-500/90 hover:bg-red-500 text-white focus:outline-none focus:ring-2 focus:ring-red-400 transition-all"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={!inputText.trim() || inputDisabled}
            aria-label="Send"
            className="shrink-0 p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-center mt-2">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <ShriGaneshAvatar className="h-3.5 w-3.5" ringClassName="ring ring-white/15" />
            <span>Powered by Vedic AI • Trained on ancient astrological texts</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMainArea;
