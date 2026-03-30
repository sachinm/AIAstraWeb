/**
 * Tests for ChatSection: syncing modal is dismissed when auth.kundli_added is true
 * and kundlis.queue_status is 'completed' (per meDetails / fetchUserDetails).
 * Speech-to-text: mic button visible/disabled, stop only when listening, textarea/Send always present.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatSection from './ChatSection';
import * as UserData from '../UserData';
import * as chatAPI from './chatAPI';
import { useSpeechRecognition } from './useSpeechRecognition';

vi.mock('../UserData', () => ({
  fetchUserDetails: vi.fn(),
  sendChatMessage: vi.fn(),
  sendChatMessageStream: vi.fn(),
  isChatStreamEnabled: vi.fn(() => false),
  createChat: vi.fn(),
}));

vi.mock('./chatAPI', () => ({
  fetchAllChats: vi.fn(),
  fetchChatMessages: vi.fn(),
}));

const mockStartListening = vi.fn();
const mockStopListening = vi.fn();

vi.mock('./useSpeechRecognition', () => ({
  useSpeechRecognition: vi.fn(),
}));

function setSpeechRecognitionMock(overrides: Partial<ReturnType<typeof useSpeechRecognition>> = {}) {
  vi.mocked(useSpeechRecognition).mockReturnValue({
    isListening: false,
    isSupported: true,
    permissionDenied: false,
    startListening: mockStartListening,
    stopListening: mockStopListening,
    ...overrides,
  });
}

const mockUser = {
  name: 'Test User',
  dateOfBirth: '1990-01-01',
  placeOfBirth: 'Mumbai',
};

describe('ChatSection syncing modal', () => {
  beforeEach(() => {
    vi.mocked(UserData.fetchUserDetails).mockReset();
    vi.mocked(UserData.createChat).mockResolvedValue({ id: 'chat-1' });
    vi.mocked(chatAPI.fetchAllChats).mockResolvedValue([]);
    vi.mocked(chatAPI.fetchChatMessages).mockResolvedValue([]);
    setSpeechRecognitionMock();
  });

  it('shows "Syncing your chart…" when kundli_added is false', async () => {
    vi.mocked(UserData.fetchUserDetails).mockResolvedValue({
      success: true,
      kundli_added: false,
      queue_status: 'in_progress',
    });

    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(() => {
      expect(screen.getByText(/Syncing your chart…/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Cosmic AI Astrologer/i)).not.toBeInTheDocument();
  });

  it('shows "Syncing your chart…" when queue_status is not completed', async () => {
    vi.mocked(UserData.fetchUserDetails).mockResolvedValue({
      success: true,
      kundli_added: true,
      queue_status: 'pending',
    });

    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(() => {
      expect(screen.getByText(/Syncing your chart…/i)).toBeInTheDocument();
    });
  });

  it('dismisses syncing modal and shows chat when kundli_added=true and queue_status=completed', async () => {
    vi.mocked(UserData.fetchUserDetails).mockResolvedValue({
      success: true,
      kundli_added: true,
      queue_status: 'completed',
    });

    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(
      () => {
        expect(screen.getByText(/Cosmic AI Astrologer/i)).toBeInTheDocument();
        expect(screen.queryByText(/Syncing your chart…/i)).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('keeps modal when success is false', async () => {
    vi.mocked(UserData.fetchUserDetails).mockResolvedValue({
      success: false,
      message: 'Not authenticated',
    });

    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(() => {
      expect(screen.getByText(/Syncing your chart…/i)).toBeInTheDocument();
    });
  });
});

describe('ChatSection speech-to-text and input area', () => {
  beforeEach(() => {
    vi.mocked(UserData.fetchUserDetails).mockResolvedValue({
      success: true,
      kundli_added: true,
      queue_status: 'completed',
    });
    vi.mocked(UserData.createChat).mockResolvedValue({ id: 'chat-1' });
    vi.mocked(chatAPI.fetchAllChats).mockResolvedValue([]);
    vi.mocked(chatAPI.fetchChatMessages).mockResolvedValue([]);
    setSpeechRecognitionMock();
  });

  it('shows textarea and Send button when chat is ready', async () => {
    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(
      () => {
        expect(screen.getByPlaceholderText(/Ask about your destiny/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /start voice input/i })).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeInTheDocument();
  });

  it('microphone button is present and disabled when speech unsupported', async () => {
    setSpeechRecognitionMock({ isSupported: false });

    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /microphone unavailable/i })).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
    const micButton = screen.getByRole('button', { name: /microphone unavailable/i });
    expect(micButton).toBeDisabled();
  });

  it('stop button is not rendered when not listening', async () => {
    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(
      () => {
        expect(screen.getByPlaceholderText(/Ask about your destiny/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
    expect(screen.queryByRole('button', { name: /stop listening/i })).not.toBeInTheDocument();
  });

  it('shows Listening... and stop button when listening', async () => {
    setSpeechRecognitionMock({ isListening: true });

    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(
      () => {
        expect(screen.getByText(/Listening.../i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /stop listening/i })).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('clicking mic button calls startListening when supported', async () => {
    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /start voice input/i })).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /start voice input/i }));
    expect(mockStartListening).toHaveBeenCalledTimes(1);
  });
});

describe('ChatSection existing conversations', () => {
  const createdIso = new Date('2025-01-15T12:00:00.000Z').toISOString();

  beforeEach(() => {
    vi.mocked(UserData.fetchUserDetails).mockResolvedValue({
      success: true,
      kundli_added: true,
      queue_status: 'completed',
    });
    vi.mocked(UserData.createChat).mockResolvedValue({ id: 'chat-new' });
    vi.mocked(chatAPI.fetchAllChats).mockResolvedValue([
      {
        id: 'existing-1',
        user_id: 'user-1',
        name: 'Prior thread',
        is_active: true,
        created_at: createdIso,
      },
    ]);
    vi.mocked(chatAPI.fetchChatMessages).mockResolvedValue([
      {
        id: 'msg-1',
        chat_id: 'existing-1',
        question: 'What about my chart?',
        ai_answer: 'Here is guidance.',
        created_at: createdIso,
      },
    ]);
    setSpeechRecognitionMock();
  });

  it('loads existing chats and messages without creating a new chat', async () => {
    vi.mocked(UserData.createChat).mockClear();

    render(<ChatSection user={mockUser} activeChatId={null} />);

    await waitFor(
      () => {
        expect(screen.getByText(/Cosmic AI Astrologer/i)).toBeInTheDocument();
        expect(screen.getByText('What about my chart?')).toBeInTheDocument();
        expect(screen.getByText('Here is guidance.')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(UserData.createChat).not.toHaveBeenCalled();
    expect(chatAPI.fetchChatMessages).toHaveBeenCalledWith('existing-1');
  });
});
