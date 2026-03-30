import React from 'react';
import { Plus, MessageCircle, X } from 'lucide-react';
import type { SidebarChatRow } from './chatThreadUtils';

interface ChatSidebarProps {
  chats: SidebarChatRow[];
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  chatListDisabled?: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chats,
  activeChatId,
  onChatSelect,
  onNewChat,
  onClose,
  chatListDisabled = false,
}) => {
  return (
    <div className="w-full min-w-0 bg-black/40 backdrop-blur-md border-r border-white/10 h-full max-h-screen overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Conversations</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <button
          onClick={onNewChat}
          className="w-full flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 text-white font-medium"
        >
          <Plus className="w-5 h-5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chats.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No conversations yet</p>
            <p className="text-gray-500 text-sm">Start your first chat to get cosmic insights</p>
          </div>
        ) : (
          chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              disabled={chatListDisabled}
              onClick={() => onChatSelect(chat.id)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-300 ${
                activeChatId === chat.id
                  ? 'bg-purple-600/30 border border-purple-500/30'
                  : 'hover:bg-white/5'
              } ${chatListDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{chat.name}</h3>
                  <p className="text-gray-400 text-sm truncate mt-1">{chat.lastMessage}</p>
                  <p className="text-gray-500 text-xs mt-1">{chat.timestamp}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Cosmic Quote */}
      <div className="p-4 bg-gradient-to-t from-black/60 to-transparent">
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <p className="text-purple-300 text-sm italic">
            "The stars align to guide those who seek wisdom..."
          </p>
          <p className="text-gray-500 text-xs mt-1">- Ancient Vedic Wisdom</p>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;