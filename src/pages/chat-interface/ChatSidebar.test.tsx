import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatSidebar from './ChatSidebar';
import type { SidebarChatRow } from './chatThreadUtils';

const row = (id: string, name: string, category: string, pinned = false): SidebarChatRow =>
  ({ id, name, lastMessage: 'Tap to continue', timestamp: 'Oct 25', category, pinned }) as SidebarChatRow;

const chats = [row('1', 'Pinned one', 'general', true), row('2', 'About my love life', 'general'), row('3', 'Job change', 'work')];

const renderList = () =>
  render(<ChatSidebar variant="rail" chats={chats} activeChatId={null} onChatSelect={vi.fn()} onNewChat={vi.fn()} onClose={vi.fn()} />);

describe('ChatSidebar groups (Sachin, 2026-11-05)', () => {
  beforeEach(() => localStorage.clear());

  it('collapses one group and keeps the others open', async () => {
    const u = userEvent.setup();
    renderList();
    expect(screen.getByText('About my love life')).toBeInTheDocument();
    await u.click(screen.getByTestId('conversation-group-general'));
    expect(screen.queryByText('About my love life')).not.toBeInTheDocument();
    expect(screen.getByText('Pinned one')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-group-general')).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses and expands every group at once, and remembers it', async () => {
    const u = userEvent.setup();
    const { unmount } = renderList();
    await u.click(screen.getByRole('button', { name: 'Collapse all conversations' }));
    for (const name of ['Pinned one', 'About my love life', 'Job change']) expect(screen.queryByText(name)).not.toBeInTheDocument();
    unmount();
    renderList();
    expect(screen.queryByText('Job change')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Expand all conversations' }));
    expect(screen.getByText('Job change')).toBeInTheDocument();
  });
});
