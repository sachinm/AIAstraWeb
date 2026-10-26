import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import {
  sendChatMessage,
  sendChatMessageStream,
  isChatStreamEnabled,
  isClarifyEnabled,
  answerClarify,
  confirmClarifyStream,
  fetchUserDetails,
  createChat,
} from '../UserData';
import { SUBJECT_CHIPS, shouldSendOnKey, toClarifyView, loadSidebarPrefs, saveSidebarPrefs } from './readingUi';
import { fetchAllChats, fetchChatMessages } from './chatAPI';
import ChatRightSidebar from './ChatRightSidebar';
import ChatLeftSidebarLayout from './ChatLeftSidebarLayout';
import ChatMainArea from './ChatMainArea';
import { useSpeechRecognition } from './useSpeechRecognition';
import { applyReadingEvent, nextPartsOf, type NextPart } from './readingProgress';
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
  // sidebars remember open/closed per device (chat-interface-review §3.3)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => loadSidebarPrefs({ leftOpen: false, rightOpen: false }).leftOpen);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => loadSidebarPrefs({ leftOpen: false, rightOpen: false }).rightOpen);
  const [clarifyBusy, setClarifyBusy] = useState(false);
  useEffect(() => {
    saveSidebarPrefs({ leftOpen: isSidebarOpen, rightOpen: isRightSidebarOpen });
  }, [isSidebarOpen, isRightSidebarOpen]);
  const [activeChat, setActiveChat] = useState<string | null>(activeChatId ?? null);
  const [chats, setChats] = useState<SidebarChatRow[]>([]);
  const [chatCreationDone, setChatCreationDone] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const inputTextAtSpeechStartRef = useRef('');
  const mountedRef = useRef(true);
  /** Bumped by every new question: a running multi-part chain stops when the person asks something else. */
  const partsRunRef = useRef(0);

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

  /** Labels the first answer once the server says how many parts the question has. */
  const labelFirstPart = (messageId: string, parts: NextPart[]) =>
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, partHeader: `Part 1 of ${parts.length + 1}: ${m.progress?.subjects?.[0] ?? 'your first question'}` } : m
      )
    );

  /**
   * Answers the remaining parts of a multi-part question one after another. Each part is its own reading on the server
   * (fresh budget, own run, own message). The server's `next` event after each part says what is left, so the chain
   * ends when nothing is left, on an error, or when the person asks something else.
   */
  const continueParts = async (question: string, first: NextPart[], chatId: string | null) => {
    const run = partsRunRef.current;
    const total = first.length + 1;
    let pending = first;
    let index = 2;
    let thread = chatId;
    while (pending.length && mountedRef.current && partsRunRef.current === run) {
      const [part, ...rest] = pending;
      const id = `${Date.now()}-part-${part.id}`;
      let next: NextPart[] = [];
      setMessages((prev) => [
        ...prev,
        {
          id,
          text: '',
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          partHeader: `Part ${index} of ${Math.max(total, index)}: ${part.label}`,
        },
      ]);
      setIsTyping(true);
      setStreamingMessageId(id);
      try {
        const { answer, chatId: cid } = await sendChatMessageStream(
          question,
          thread,
          (delta) => {
            if (!mountedRef.current || !delta) return;
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: m.text + delta } : m)));
          },
          {
            focus: { subject: part.id, parts: rest.map((p) => p.id) },
            onEvent: (ev) => {
              if (!mountedRef.current) return;
              if (ev.type === 'next') next = nextPartsOf(ev);
              setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, progress: applyReadingEvent(m.progress, ev) } : m)));
            },
          }
        );
        thread = cid || thread;
        if (mountedRef.current) {
          if (thread) setActiveChat(thread);
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: answer } : m)));
        }
      } catch (err) {
        if (mountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Something went wrong';
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: m.text || msg } : m)));
        }
        break;
      } finally {
        if (mountedRef.current) {
          setStreamingMessageId(null);
          setIsTyping(false);
        }
      }
      pending = next;
      index += 1;
    }
  };

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    partsRunRef.current += 1; // a new question stops any multi-part chain still running
    let continueFrom: { chatId: string | null; parts: NextPart[] } | null = null;

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
        let nextParts: NextPart[] = [];
        const { answer, chatId, clarifyingRunId } = await sendChatMessageStream(
          userMessage.text,
          activeChat,
          (delta) => {
            if (!mountedRef.current || !delta) return;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiPlaceholderId ? { ...m, text: m.text + delta } : m))
            );
          },
          {
            clarify: isClarifyEnabled(),
            onEvent: (ev) => {
              if (!mountedRef.current) return;
              if (ev.type === 'next') {
                nextParts = nextPartsOf(ev);
                if (nextParts.length) labelFirstPart(aiPlaceholderId, nextParts);
              }
              const view = toClarifyView(ev as Record<string, unknown>);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id !== aiPlaceholderId ? m : view ? { ...m, clarify: view, clarifyQuestion: trimmed } : { ...m, progress: applyReadingEvent(m.progress, ev) }
                )
              );
            },
          }
        );
        if (clarifyingRunId) return; // the card on the message now drives the conversation
        if (mountedRef.current) {
          setActiveChat(chatId);
          setMessages((prev) =>
            prev.map((m) => (m.id === aiPlaceholderId ? { ...m, text: answer } : m))
          );
          updateSidebarPreview(chatId ?? threadIdAtSend, trimmed);
          if (nextParts.length) continueFrom = { chatId, parts: nextParts };
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
    // the other parts of the question, one after another (only after this answer's stream has fully closed)
    if (continueFrom) await continueParts(trimmed, continueFrom.parts, continueFrom.chatId);
  };

  // Enter sends, Shift+Enter is a new line (chat-interface-review §3.4)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (shouldSendOnKey(e as unknown as { key: string; shiftKey: boolean; nativeEvent: { isComposing?: boolean } })) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const setClarify = (messageId: string, view: UiMessage['clarify'] | undefined) =>
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, clarify: view } : m)));

  /** A chip or typed answer to the clarify agent. */
  const handleClarifyAnswer = async (messageId: string, runId: string, value: string, viaChip: boolean) => {
    setClarifyBusy(true);
    try {
      const next = await answerClarify(runId, value, viaChip);
      if (!mountedRef.current) return;
      const view = toClarifyView(next as unknown as Record<string, unknown>);
      if (view) setClarify(messageId, view);
    } catch (err) {
      if (mountedRef.current) setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, clarify: undefined, text: err instanceof Error ? err.message : 'Something went wrong' } : m)));
    } finally {
      if (mountedRef.current) setClarifyBusy(false);
    }
  };

  /** "Yes, read it": stream the reading into the same message. */
  const handleClarifyConfirm = async (messageId: string, runId: string) => {
    const question = messages.find((m) => m.id === messageId)?.clarifyQuestion ?? '';
    partsRunRef.current += 1;
    let nextParts: NextPart[] = [];
    let continueFrom: { chatId: string | null; parts: NextPart[] } | null = null;
    setClarify(messageId, undefined);
    setIsTyping(true);
    setStreamingMessageId(messageId);
    try {
      const { answer, chatId } = await confirmClarifyStream(
        runId,
        activeChat,
        (delta) => {
          if (!mountedRef.current || !delta) return;
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: m.text + delta } : m)));
        },
        {
          onEvent: (ev) => {
            if (!mountedRef.current) return;
            if (ev.type === 'next') {
              nextParts = nextPartsOf(ev);
              if (nextParts.length) labelFirstPart(messageId, nextParts);
            }
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, progress: applyReadingEvent(m.progress, ev) } : m)));
          },
        }
      );
      if (mountedRef.current && chatId) {
        setActiveChat(chatId);
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: answer } : m)));
        updateSidebarPreview(chatId, question);
        if (nextParts.length) continueFrom = { chatId, parts: nextParts };
      }
    } catch (err) {
      if (mountedRef.current) setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: m.text || (err instanceof Error ? err.message : 'Something went wrong') } : m)));
    } finally {
      if (mountedRef.current) {
        setStreamingMessageId(null);
        setIsTyping(false);
      }
    }
    // "love first" was confirmed: now the other parts, one after another
    if (continueFrom) await continueParts(question, continueFrom.parts, continueFrom.chatId);
  };

  /** "Change": put the question back in the input so the person can rephrase it. */
  const handleClarifyChange = (messageId: string) => {
    const question = messages.find((m) => m.id === messageId)?.clarifyQuestion ?? '';
    setClarify(messageId, undefined);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: 'Okay, edit your question below.' } : m)));
    setInputText(question);
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

  // subject chips replace the old quick questions (no remedies or mantras, which the app does not answer)
  const quickQuestions = SUBJECT_CHIPS.map((c) => c.question);

  const chatListDisabled = isTyping || !!streamingMessageId || historyLoading || !chatCreationDone;
  const mainBusy = historyLoading || !chatCreationDone;
  const inputDisabled = isTyping || mainBusy;

  if (kundliReady === null || kundliReady === false) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
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
    <div className="relative flex min-h-0 flex-1">
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
        clarifyBusy={clarifyBusy}
        onClarifyAnswer={(id, runId, value, viaChip) => void handleClarifyAnswer(id, runId, value, viaChip)}
        onClarifyConfirm={(id, runId) => void handleClarifyConfirm(id, runId)}
        onClarifyChange={handleClarifyChange}
      />

      <ChatRightSidebar isOpen={isRightSidebarOpen} onOpenChange={setIsRightSidebarOpen} />
    </div>
  );
};

export default ChatSection;
