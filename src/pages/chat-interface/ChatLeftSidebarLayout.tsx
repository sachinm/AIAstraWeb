import React from 'react';
import { Menu, X, Plus } from 'lucide-react';
import ChatSidebar from './ChatSidebar';
import type { SidebarChatRow } from './chatThreadUtils';

export interface ChatLeftSidebarLayoutProps {
  sidebarRef: React.RefObject<HTMLDivElement>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleNewChat: () => void;
  chats: SidebarChatRow[];
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onClose: () => void;
  chatListDisabled?: boolean;
}

const ChatLeftSidebarLayout: React.FC<ChatLeftSidebarLayoutProps> = ({
  sidebarRef,
  isSidebarOpen,
  setIsSidebarOpen,
  handleNewChat,
  chats,
  activeChatId,
  onChatSelect,
  onClose,
  chatListDisabled = false,
}) => {
  return (
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
        <div className="hidden md:flex flex-col items-center gap-4 p-3 w-14 bg-black/60 border-r border-white/10">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((open) => !open)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            className="p-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white transition"
            aria-label="Start new conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {isSidebarOpen && (
          <div className="flex-1 md:w-56 bg-black/70 min-w-0">
            <ChatSidebar
              chats={chats}
              activeChatId={activeChatId}
              onChatSelect={onChatSelect}
              onNewChat={handleNewChat}
              onClose={onClose}
              chatListDisabled={chatListDisabled}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatLeftSidebarLayout;
