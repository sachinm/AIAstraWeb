import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const chatProps = vi.fn();
vi.mock('../pages/chat-interface/ChatSection', () => ({
  default: (p: Record<string, unknown>) => {
    chatProps(p);
    return <div data-testid="chat-stub" />;
  },
}));

import BoardAsk from './BoardAsk';
import ChatSidebar, { groupByCategory } from '../pages/chat-interface/ChatSidebar';

describe('Ask everywhere (docs/reading-engine/51)', () => {
  it('the board icon opens a 98% modal with the chat set to that board', () => {
    render(<BoardAsk category="work" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask about Work' }));
    const modal = screen.getByTestId('ask-modal');
    expect(modal).toHaveStyle({ width: '98vw', height: '98vh' });
    expect(modal).toHaveAttribute('aria-label', 'Ask about Work');
    expect(chatProps).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'work', focus: 'career_job', placeholder: 'Ask about your work map…', embedded: true }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('ask-modal')).not.toBeInTheDocument();
  });

  it('the conversation list groups by category, General Reading first', () => {
    const rows = [
      { id: '1', name: 'Job change?', lastMessage: '', timestamp: '', category: 'work' },
      { id: '2', name: 'My nature', lastMessage: '', timestamp: '', category: 'general' },
      { id: '3', name: 'Old', lastMessage: '', timestamp: '', category: 'unknown' },
    ];
    render(
      <MemoryRouter>
        <ChatSidebar chats={rows} activeChatId={null} onChatSelect={() => undefined} onNewChat={() => undefined} onClose={() => undefined} />
      </MemoryRouter>,
    );
    const headings = screen.getAllByText(/^(General|Work)$/).map((e) => e.textContent);
    expect(headings).toEqual(['General', 'Work']);
    expect(screen.getByText('Old')).toBeInTheDocument();
  });
  it('pinned threads sit above every category; the pin button toggles', () => {
    const rows = [
      { id: '1', name: 'Job change?', lastMessage: '', timestamp: '', category: 'work' },
      { id: '2', name: 'My nature', lastMessage: '', timestamp: '', category: 'general', pinned: true },
      { id: '3', name: 'Today?', lastMessage: '', timestamp: '', category: 'today' },
    ];
    expect(groupByCategory(rows).map(([k, r]) => [k, r.map((x) => x.id)])).toEqual([['pinned', ['2']], ['today', ['3']], ['work', ['1']]]);
    const onTogglePin = vi.fn();
    render(
      <MemoryRouter>
        <ChatSidebar chats={rows} activeChatId={null} onChatSelect={() => undefined} onNewChat={() => undefined} onClose={() => undefined} onTogglePin={onTogglePin} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Pinned')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unpin My nature' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin Job change?' }));
    expect(onTogglePin.mock.calls).toEqual([['2', false], ['1', true]]);
  });
});
