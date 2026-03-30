import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import {
  sendChatMessage,
  sendChatMessageStream,
  isChatStreamEnabled,
  fetchUserDetails,
  createChat,
} from '../UserData';
import { fetchAllChats, fetchChatMessages } from './chatAPI';
import ChatRightSidebar from './ChatRightSidebar';
import ChatLeftSidebarLayout from './ChatLeftSidebarLayout';
import ChatMainArea from './ChatMainArea';
import { useSpeechRecognition } from './useSpeechRecognition';
import { trackChatQuestionSent } from '../../lib/analytics';
import {
  MAX_SIDEBAR_CHATS,
  mapApiMessagesToUi,
  chatToSidebarRow,
  snippetFromQuestion,
  WELCOME_TEXT_INITIAL,
  WELCOME_TEXT_NEW_THREAD,
  type UiMessage,
  type SidebarChatRow,
} from './chatThreadUtils';

interface User {
  name: string;
  dateOfBirth: string;
  placeOfBirth: string;
}

interface ChatSectionProps {
  user: User;
  activeChatId: string | null;
}

const POLL_INTERVAL_MS = 3000;

const ChatSection: React.FC<ChatSectionProps> = ({ user: _user, activeChatId }) => {
  const [kundliReady, setKundliReady] = useState<boolean | null>(null);
  const pollIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [askElapsedSec, setAskElapsedSec] = useState(0);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(activeChatId ?? null);
  const [chats, setChats] = useState<SidebarChatRow[]>([]);
  const [chatCreationDone, setChatCreationDone] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const inputTextAtSpeechStartRef = useRef('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const loadChatHistory = useCallback(async (chatId: string) => {
    setHistoryLoading(true);
    setStreamingMessageId(null);
    try {
      const rows = await fetchChatMessages(chatId);
      if (!mountedRef.current) return;
      setMessages(mapApiMessagesToUi(rows));
      if (rows.length > 0) {
        const last = rows[rows.length - 1];
        const snippet = snippetFromQuestion(last.question);
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, lastMessage: snippet, timestamp: 'Now' } : c))
        );
      }
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (kundliReady !== true || chatCreationDone) return;
    let cancelled = false;
    (async () => {
      let all: Awaited<ReturnType<typeof fetchAllChats>>;
      try {
        all = await fetchAllChats();
      } catch {
        if (cancelled) return;
        try {
          const { id } = await createChat();
          if (cancelled) return;
          const row: SidebarChatRow = {
            id,
            name: 'New Conversation',
            lastMessage: 'Chat started',
            timestamp: 'Now',
          };
          setChats([row]);
          setActiveChat(id);
          setMessages([
            {
              id: '1',
              text: WELCOME_TEXT_INITIAL,
              sender: 'ai',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } catch {
          // leave messages empty
        }
        if (mountedRef.current) setChatCreationDone(true);
        return;
      }
      if (cancelled) return;
      const slice = all.slice(0, MAX_SIDEBAR_CHATS);
      if (slice.length > 0) {
        setChats(slice.map(chatToSidebarRow));
        const firstId = slice[0].id;
        setActiveChat(firstId);
        try {
          await loadChatHistory(firstId);
        } catch {
          if (mountedRef.current) setMessages(mapApiMessagesToUi([]));
        }
        if (cancelled) return;
        setChatCreationDone(true);
      } else {
        try {
          const { id } = await createChat();
          if (cancelled) return;
          const row: SidebarChatRow = {
            id,
            name: 'New Conversation',
            lastMessage: 'Chat started',
            timestamp: 'Now',
          };
          setChats([row]);
          setActiveChat(id);
          setMessages([
            {
              id: '1',
              text: WELCOME_TEXT_INITIAL,
              sender: 'ai',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          setChatCreationDone(true);
        } catch {
          if (mountedRef.current) setChatCreationDone(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kundliReady, chatCreationDone, loadChatHistory]);

  useEffect(() => {
    const handleResize = () => {};

    const handleClickOutside = (event: MouseEvent) => {
      if (
        window.innerWidth < 768 &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
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

  useEffect(() => {
    if (!isTyping) {
      setAskElapsedSec(0);
      return;
    }
    setAskElapsedSec(0);
    const id = window.setInterval(() => {
      setAskElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTyping]);

  const updateSidebarPreview = useCallback((threadId: string | null, questionPreview: string) => {
    if (!threadId) return;
    const preview = questionPreview.length > 80 ? `${questionPreview.slice(0, 80)}…` : questionPreview;
    setChats((prev) =>
      prev.map((c) =>
        c.id === threadId ? { ...c, lastMessage: preview, timestamp: 'Now' } : c
      )
    );
  }, []);

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    trackChatQuestionSent(trimmed);

    const threadIdAtSend = activeChat;

    const userMessage: UiMessage = {
      id: Date.now().toString(),
      text: trimmed,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    setStreamingMessageId(null);

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let streamPlaceholderId: string | null = null;

    try {
      if (isChatStreamEnabled()) {
        const aiPlaceholderId = (Date.now() + 1).toString();
        streamPlaceholderId = aiPlaceholderId;
        setStreamingMessageId(aiPlaceholderId);
        setMessages((prev) => [...prev, { id: aiPlaceholderId, text: '', sender: 'ai', timestamp: ts }]);
        const { answer, chatId } = await sendChatMessageStream(userMessage.text, activeChat, (delta) => {
          if (!mountedRef.current || !delta) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiPlaceholderId ? { ...m, text: m.text + delta } : m))
          );
        });
        if (mountedRef.current) {
          setActiveChat(chatId);
          setMessages((prev) =>
            prev.map((m) => (m.id === aiPlaceholderId ? { ...m, text: answer } : m))
          );
          updateSidebarPreview(chatId ?? threadIdAtSend, trimmed);
        }
      } else {
        const aiText = await sendChatMessage(userMessage.text, activeChat);
        const aiResponse: UiMessage = {
          id: (Date.now() + 1).toString(),
          text: aiText,
          sender: 'ai',
          timestamp: ts,
        };
        setMessages((prev) => [...prev, aiResponse]);
        updateSidebarPreview(threadIdAtSend, trimmed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (streamPlaceholderId && mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) => (m.id === streamPlaceholderId ? { ...m, text: m.text || msg } : m))
        );
      } else if (mountedRef.current) {
        const errorMessage: UiMessage = {
          id: (Date.now() + 2).toString(),
          text: msg,
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      if (mountedRef.current) {
        setStreamingMessageId(null);
        setIsTyping(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleNewChat = async () => {
    try {
      const { id } = await createChat();
      const newChat: SidebarChatRow = {
        id,
        name: 'New Conversation',
        lastMessage: 'Chat started',
        timestamp: 'Now',
      };
      setChats((prev) => [newChat, ...prev].slice(0, MAX_SIDEBAR_CHATS));
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
          text: WELCOME_TEXT_NEW_THREAD,
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    } catch {
      const fallbackId = Date.now().toString();
      setChats((prev) =>
        [{ id: fallbackId, name: 'New Conversation', lastMessage: 'Chat started', timestamp: 'Now' }, ...prev].slice(
          0,
          MAX_SIDEBAR_CHATS
        )
      );
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
          text: WELCOME_TEXT_NEW_THREAD,
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleChatSelect = (chatId: string) => {
    if (isTyping || streamingMessageId || historyLoading || !chatCreationDone) return;
    if (chatId !== activeChat) {
      setActiveChat(chatId);
      void loadChatHistory(chatId);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const quickQuestions = [
    'What does my birth chart say about my career?',
    'Can you suggest remedies for better health?',
    'What mantras should I chant for prosperity?',
    'How can I improve my relationships?',
    "What is my life's purpose according to Vedic astrology?",
    'Are there any upcoming favorable periods?',
  ];

  const chatListDisabled = isTyping || !!streamingMessageId || historyLoading || !chatCreationDone;
  const mainBusy = historyLoading || !chatCreationDone;
  const inputDisabled = isTyping || mainBusy;

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
      {isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <ChatLeftSidebarLayout
        sidebarRef={sidebarRef}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleNewChat={handleNewChat}
        chats={chats}
        activeChatId={activeChat}
        onChatSelect={handleChatSelect}
        onClose={() => setIsSidebarOpen(false)}
        chatListDisabled={chatListDisabled}
      />

      <ChatMainArea
        messages={messages}
        streamingMessageId={streamingMessageId}
        isTyping={isTyping}
        askElapsedSec={askElapsedSec}
        historyLoading={mainBusy}
        inputText={inputText}
        setInputText={setInputText}
        onSend={() => void handleSendMessage()}
        onKeyDown={handleKeyDown}
        quickQuestions={quickQuestions}
        isListening={isListening}
        isSupported={isSupported}
        permissionDenied={permissionDenied}
        onStartListening={handleStartListening}
        onStopListening={stopListening}
        inputDisabled={inputDisabled}
      />

      <ChatRightSidebar isOpen={isRightSidebarOpen} onOpenChange={setIsRightSidebarOpen} />
    </div>
  );
};

export default ChatSection;
