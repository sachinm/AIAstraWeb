import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChatSection from './ChatSection';
import * as UserData from '../UserData';
import { usePlan } from '../../Auth/ProfileGate';
import { QuotaExhaustedError, type PlanStatus } from '../../lib/billing';

vi.mock('../UserData', () => ({
  fetchUserDetails: vi.fn(),
  sendChatMessage: vi.fn(),
  sendChatMessageStream: vi.fn(),
  isChatStreamEnabled: vi.fn(() => true),
  isClarifyEnabled: vi.fn(() => false),
  answerClarify: vi.fn(),
  confirmClarifyStream: vi.fn(),
  createChat: vi.fn().mockResolvedValue({ id: 'chat-1' }),
}));
vi.mock('./chatAPI', () => ({
  fetchAllChats: vi.fn().mockResolvedValue([]),
  fetchChatMessages: vi.fn().mockResolvedValue([]),
}));
vi.mock('./useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({ isListening: false, isSupported: true, permissionDenied: false, startListening: vi.fn(), stopListening: vi.fn() }),
}));
vi.mock('./useQuestionLocation', () => ({
  QUESTION_LOCATION_ASK_TEXT: '',
  useQuestionLocation: () => ({ status: null, ensureLocation: async () => null, currentLocation: () => null, reask: async () => {} }),
}));
vi.mock('../../Auth/ProfileGate', () => ({ useMe: () => null, useRefreshMe: () => async () => {}, usePlan: vi.fn() }));

const plan = (used: number): PlanStatus => ({
  code: 'free',
  desired_plan: null,
  desired_interval: null,
  is_paid: false,
  interval: null,
  used,
  limit: 5,
  remaining: 5 - used,
  window: 'lifetime',
  resets_at: null,
  exempt: false,
});

const renderChat = () =>
  render(
    <MemoryRouter>
      <ChatSection user={{ name: 'A', dateOfBirth: '', placeOfBirth: '' }} activeChatId={null} />
    </MemoryRouter>
  );

/** The input is disabled until the chat list has loaded. */
const readyInput = async () => {
  await waitFor(() => expect(screen.getByPlaceholderText(/Ask about/)).toBeEnabled());
  return screen.getByPlaceholderText(/Ask about/);
};

describe('ChatSection question limits', () => {
  const setPlan = vi.fn();

  beforeEach(() => {
    setPlan.mockReset();
    vi.mocked(UserData.fetchUserDetails).mockResolvedValue({ success: true, kundli_added: true, queue_status: 'completed' });
    vi.mocked(UserData.sendChatMessageStream).mockReset();
  });

  it('shows the upgrade card in place of the input when no questions are left', async () => {
    vi.mocked(usePlan).mockReturnValue({ plan: plan(5), setPlan, refreshPlan: vi.fn() });
    renderChat();
    expect(await screen.findByText(/Choose a plan to keep asking/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Ask about/)).not.toBeInTheDocument();
  });

  it('keeps the input with questions left, or with limits off', async () => {
    vi.mocked(usePlan).mockReturnValue({ plan: plan(4), setPlan, refreshPlan: vi.fn() });
    const { unmount } = renderChat();
    expect(await screen.findByPlaceholderText(/Ask about/)).toBeInTheDocument();
    unmount();
    vi.mocked(usePlan).mockReturnValue({ plan: null, setPlan, refreshPlan: vi.fn() });
    renderChat();
    expect(await screen.findByPlaceholderText(/Ask about/)).toBeInTheDocument();
    expect(screen.queryByText(/Choose a plan to keep asking/)).not.toBeInTheDocument();
  });

  it('on a 402 takes the new count and puts the question back in the box', async () => {
    vi.mocked(usePlan).mockReturnValue({ plan: plan(4), setPlan, refreshPlan: vi.fn() });
    vi.mocked(UserData.sendChatMessageStream).mockRejectedValue(new QuotaExhaustedError(plan(5), 'used'));
    renderChat();
    const user = userEvent.setup();
    await user.type(await readyInput(), 'When will I change jobs?{Enter}');
    await waitFor(() => expect(setPlan).toHaveBeenCalledWith(plan(5)));
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask about/)).toHaveValue('When will I change jobs?'));
    expect(screen.queryByText('used')).not.toBeInTheDocument();
  });

  it('updates the bar from usage events on the stream', async () => {
    vi.mocked(usePlan).mockReturnValue({ plan: plan(1), setPlan, refreshPlan: vi.fn() });
    vi.mocked(UserData.sendChatMessageStream).mockImplementation(async (_q, _c, _d, options) => {
      options?.onEvent?.({ type: 'usage', usage: plan(2) });
      return { answer: 'an answer', chatId: 'chat-1' } as never;
    });
    renderChat();
    const user = userEvent.setup();
    await user.type(await readyInput(), 'A question{Enter}');
    await waitFor(() => expect(setPlan).toHaveBeenCalledWith(plan(2)));
  });
});
