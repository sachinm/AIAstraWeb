import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Star, Menu, X, Loader2, Mic, Square, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatSidebar from './ChatSidebar';
import { sendChatMessage, fetchUserDetails, createChat } from '../UserData';
import ChatRightSidebar from './ChatRightSidebar';
import { useSpeechRecognition } from './useSpeechRecognition';

interface User {
  name: string;
  dateOfBirth: string;
  placeOfBirth: string;
}

interface ChatSectionProps {
  user: User;
  activeChatId: string | null;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: string;
}

interface ChatHistory {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
}

const POLL_INTERVAL_MS = 3000;

const ChatSection: React.FC<ChatSectionProps> = ({ user: _user, activeChatId }) => {
  const [kundliReady, setKundliReady] = useState<boolean | null>(null);
  const pollIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Namaste ! I'm your Vedic astrology guide, trained in ancient wisdom and cosmic insights. How can I illuminate your path today?`,
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(activeChatId ?? null);
  const [chats, setChats] = useState<ChatHistory[]>([]);
  const [chatCreationDone, setChatCreationDone] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const inputTextAtSpeechStartRef = useRef('');

  const onTranscript = useCallback((transcript: string) => {
    const base = inputTextAtSpeechStartRef.current;
    setInputText(base + (base && transcript ? ' ' : '') + transcript);
  }, []);

  const {
    isListening,
    isSupported,
    permissionDenied,
    startListening,
    stopListening,
  } = useSpeechRecognition({ onTranscript });

  const handleStartListening = useCallback(() => {
    inputTextAtSpeechStartRef.current = inputText;
    startListening();
  }, [inputText, startListening]);

  // Poll meDetails (auth.kundli_added + kundlis.queue_status) until sync is done
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const details = await fetchUserDetails();
        if (cancelled) return;
        const ready = Boolean(
          details.success &&
            details.kundli_added === true &&
            details.queue_status === 'completed'
        );
        setKundliReady(ready);
        if (ready && pollIdRef.current) {
          clearInterval(pollIdRef.current);
          pollIdRef.current = null;
        }
      } catch {
        if (!cancelled) setKundliReady(false);
      }
    };
    check();
    pollIdRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollIdRef.current) {
        clearInterval(pollIdRef.current);
        pollIdRef.current = null;
      }
    };
  }, []);

  // When kundli is ready, start one new chat thread (fresh conversation after login)
  useEffect(() => {
    if (kundliReady !== true || chatCreationDone) return;
    let cancelled = false;
    (async () => {
      try {
        const { id } = await createChat();
        if (cancelled) return;
        const newChat: ChatHistory = {
          id,
          name: 'New Conversation',
          lastMessage: 'Chat started',
          timestamp: 'Now',
        };
        setChats([newChat]);
        setActiveChat(id);
        setMessages([
          {
            id: '1',
            text: `Namaste ! I'm your Vedic astrology guide, trained in ancient wisdom and cosmic insights. How can I illuminate your path today?`,
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setChatCreationDone(true);
      } catch {
        if (!cancelled) setChatCreationDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [kundliReady, chatCreationDone]);

  useEffect(() => {
    const handleResize = () => {
      // Keep current open/closed state; only collapse on mobile when clicking outside.
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (window.innerWidth < 768 && 
          sidebarRef.current && 
          !sidebarRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const scrollToBottom = () => {
    const el = messagesEndRef.current;
    if (el?.scrollIntoView && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const aiText = await sendChatMessage(userMessage.text, activeChat);

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: err instanceof Error ? err.message : "Unknown error",
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = async () => {
    try {
      const { id } = await createChat();
      const newChat: ChatHistory = {
        id,
        name: 'New Conversation',
        lastMessage: 'Chat started',
        timestamp: 'Now',
      };
      setChats(prev => [newChat, ...prev]);
      setActiveChat(id);
      setMessages([
        {
          id: 'new-chat-divider',
          text: 'New conversation started',
          sender: 'system',
          timestamp: '',
        },
        {
          id: '1',
          text: `Namaste ! I'm your Vedic astrology guide. How can I help you with this new conversation?`,
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
      ]);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    } catch {
      // Fallback: at least start a local-only thread so UI doesn't block
      const fallbackId = Date.now().toString();
      setChats(prev => [{ id: fallbackId, name: 'New Conversation', lastMessage: 'Chat started', timestamp: 'Now' }, ...prev]);
      setActiveChat(fallbackId);
      setMessages([
        {
          id: 'new-chat-divider',
          text: 'New conversation started',
          sender: 'system',
          timestamp: '',
        },
        {
          id: '1',
          text: `Namaste ! I'm your Vedic astrology guide. How can I help you with this new conversation?`,
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
      ]);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const quickQuestions = [
    "What does my birth chart say about my career?",
    "Can you suggest remedies for better health?",
    "What mantras should I chant for prosperity?",
    "How can I improve my relationships?",
    "What is my life's purpose according to Vedic astrology?",
    "Are there any upcoming favorable periods?"
  ];


  if (kundliReady === null || kundliReady === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="text-center text-white p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {kundliReady === null ? 'Loading…' : 'Syncing your chart…'}
          </h3>
          <p className="text-gray-400 text-sm max-w-sm">
            {kundliReady === false
              ? 'We’re fetching your chart data. You can use chat as soon as it’s ready.'
              : 'Preparing your cosmic profile.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 768 && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" 
             onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed md:relative z-50 h-full transition-all duration-300 ease-in-out bg-black/40 border-r border-white/10
          ${
            isSidebarOpen
              ? 'translate-x-0 w-64 md:w-72'
              : '-translate-x-full w-64 md:translate-x-0 md:w-14'
          }
        `}
      >
        <div className="flex h-full">
          {/* Collapsed rail (always visible on desktop) */}
          <div className="hidden md:flex flex-col items-center gap-4 p-3 w-14 bg-black/60 border-r border-white/10">
            <button
              onClick={() => setIsSidebarOpen((open) => !open)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleNewChat}
              className="p-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white transition"
              aria-label="Start new conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Full sidebar content, hidden when collapsed on desktop */}
          {isSidebarOpen && (
            <div className="flex-1 md:w-56 bg-black/70">
              <ChatSidebar
                chats={chats}
                activeChatId={activeChat}
                onChatSelect={(chatId) => {
                  setActiveChat(chatId);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                onNewChat={handleNewChat}
                onClose={() => setIsSidebarOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-4 flex items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Cosmic AI Astrologer</h2>
              <p className="text-green-400 text-sm">Online • Ready to guide you</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                <div className={`flex items-start space-x-2 max-w-[70%] ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600'
                  }`}>
                    {message.sender === 'user' ?
                      <User className="w-4 h-4 text-white" /> :
                      <Bot className="w-4 h-4 text-white" />
                    }
                  </div>

                  {/* Message Bubble */}
                  <div className={`rounded-2xl p-4 prose prose-invert max-w-none
                    ${message.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'
                  }`}>
                    {message.sender === 'ai' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.text}
                      </ReactMarkdown>
                    ) : (
                      <p className="leading-relaxed">{message.text}</p>
                    )}
                    <p className={`text-xs mt-2 ${
                      message.sender === 'user' ? 'text-blue-200' : 'text-gray-400'
                    }`}>
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2 max-w-[70%]">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-4">
            <h3 className="text-white font-medium mb-3 flex items-center">
              <Sparkles className="w-4 h-4 text-purple-400 mr-2" />
              Quick Questions to Get Started:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {quickQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInputText(question)}
                  className="text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all duration-300 text-sm"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-black/30 backdrop-blur-md border-t border-white/10 p-4">
          {isListening && (
            <p className="text-xs text-purple-300 mb-2 flex items-center gap-1" aria-live="polite">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
              Listening...
            </p>
          )}
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={handleStartListening}
              disabled={!isSupported || isTyping || isListening}
              aria-label={!isSupported ? 'Microphone unavailable' : permissionDenied ? 'Microphone access denied; click to try again' : 'Start voice input'}
              title={!isSupported ? 'Voice input not supported in this browser' : permissionDenied ? 'Microphone access denied; click to try again' : 'Start voice input'}
              className="p-3 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex-shrink-0"
            >
              <Mic className="w-5 h-5" />
            </button>
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your destiny, remedies, or any cosmic guidance..."
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all duration-300"
                rows={1}
                disabled={isTyping}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Star className="w-5 h-5 text-purple-400" />
              </div>
              {isListening && (
                <div className="absolute right-3 bottom-3">
                  <button
                    type="button"
                    onClick={stopListening}
                    aria-label="Stop listening"
                    className="p-2 rounded-lg bg-red-500/90 hover:bg-red-500 text-white focus:outline-none focus:ring-2 focus:ring-red-400 transition-all"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isTyping}
              aria-label="Send"
              className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center justify-center mt-2">
            <p className="text-xs text-gray-500 flex items-center">
              <Bot className="w-3 h-3 mr-1" />
              Powered by Vedic AI • Trained on ancient astrological texts
            </p>
          </div>
        </div>
      </div>
      <ChatRightSidebar
        isOpen={isRightSidebarOpen}
        onOpenChange={setIsRightSidebarOpen}
      />
    </div>
  );
};

export default ChatSection;