/**
 * Question location (server docs/reading-engine/28 §4): asked once per session after the first question, sent with
 * ask-stream when granted, never when denied.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatSection from './ChatSection';
import * as UserData from '../UserData';
import * as chatAPI from './chatAPI';
import { QUESTION_LOCATION_ASK_TEXT } from './useQuestionLocation';

vi.mock('../UserData', () => ({
  fetchUserDetails: vi.fn(),
  sendChatMessage: vi.fn(),
  sendChatMessageStream: vi.fn(),
  isChatStreamEnabled: vi.fn(() => true),
  isClarifyEnabled: vi.fn(() => false),
  answerClarify: vi.fn(),
  confirmClarifyStream: vi.fn(),
  createChat: vi.fn(),
}));

vi.mock('./chatAPI', () => ({
  fetchAllChats: vi.fn(),
  fetchChatMessages: vi.fn(),
}));

vi.mock('./useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    isSupported: true,
    permissionDenied: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

const getCurrentPosition = vi.fn();
const mockUser = { name: 'Test User', dateOfBirth: '1990-01-01', placeOfBirth: 'Mumbai' };

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByPlaceholderText(/Ask about work, money/i);
  await user.type(input, text);
  await user.click(screen.getByRole('button', { name: /^send$/i }));
}

async function renderReady() {
  render(<ChatSection user={mockUser} activeChatId={null} />);
  await waitFor(() => expect(screen.getByPlaceholderText(/Ask about work, money/i)).not.toBeDisabled(), { timeout: 2000 });
}

describe('ChatSection question location', () => {
  beforeEach(() => {
    sessionStorage.clear();
    getCurrentPosition.mockReset();
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
    vi.mocked(UserData.fetchUserDetails).mockResolvedValue({ success: true, kundli_added: true, queue_status: 'completed' });
    vi.mocked(UserData.createChat).mockResolvedValue({ id: 'chat-1' });
    vi.mocked(UserData.sendChatMessageStream).mockReset().mockResolvedValue({ answer: 'ok', chatId: 'chat-1' });
    vi.mocked(chatAPI.fetchAllChats).mockResolvedValue([]);
    vi.mocked(chatAPI.fetchChatMessages).mockResolvedValue([]);
  });
  afterEach(() => {
    // @ts-expect-error test cleanup of the stubbed property
    delete navigator.geolocation;
  });

  it('asks only after the first question, once, and sends the rounded location', async () => {
    getCurrentPosition.mockImplementation((ok: (p: unknown) => void) => ok({ coords: { latitude: 43.653226, longitude: -79.383184 } }));
    const user = userEvent.setup();
    await renderReady();

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByText(QUESTION_LOCATION_ASK_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText('Using your birth place')).toBeInTheDocument();

    await ask(user, 'Will I get the job?');
    await waitFor(() => expect(UserData.sendChatMessageStream).toHaveBeenCalledTimes(1));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByText(QUESTION_LOCATION_ASK_TEXT)).toBeInTheDocument();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(vi.mocked(UserData.sendChatMessageStream).mock.calls[0]![3]).toMatchObject({ location: { lat: 43.65, lon: -79.38, tz } });
    await waitFor(() => expect(screen.getByText('Using your current location')).toBeInTheDocument());

    await waitFor(() => expect(screen.getByPlaceholderText(/Ask about work, money/i)).not.toBeDisabled());
    await ask(user, 'And my health?');
    await waitFor(() => expect(UserData.sendChatMessageStream).toHaveBeenCalledTimes(2));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(vi.mocked(UserData.sendChatMessageStream).mock.calls[1]![3]).toMatchObject({ location: { lat: 43.65, lon: -79.38 } });
  });

  it('denied: no location sent and no second ask', async () => {
    getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1, message: 'denied' }));
    const user = userEvent.setup();
    await renderReady();

    await ask(user, 'Will I get the job?');
    await waitFor(() => expect(UserData.sendChatMessageStream).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask about work, money/i)).not.toBeDisabled());
    await ask(user, 'And my health?');
    await waitFor(() => expect(UserData.sendChatMessageStream).toHaveBeenCalledTimes(2));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    for (const call of vi.mocked(UserData.sendChatMessageStream).mock.calls) expect(call[3]?.location ?? null).toBeNull();
    expect(screen.getByText('Using your birth place')).toBeInTheDocument();
  });

  it('the change link asks again', async () => {
    getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1, message: 'denied' }));
    const user = userEvent.setup();
    await renderReady();
    await ask(user, 'Will I get the job?');
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));

    getCurrentPosition.mockImplementation((ok: (p: unknown) => void) => ok({ coords: { latitude: 19.076, longitude: 72.8777 } }));
    await user.click(screen.getByRole('button', { name: /use my location/i }));
    await waitFor(() => expect(screen.getByText('Using your current location')).toBeInTheDocument());
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });
});
