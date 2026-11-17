import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AiUnavailableModal from '../components/AiUnavailableModal';
import { AskButton } from '../components/AskModal';
import { announceAiUnavailable, clearAiUnavailable, closeAiNotice } from './aiStatus';

afterEach(() => act(() => clearAiUnavailable()));

describe('assistant unavailable', () => {
  it('shows a full-screen notice, disables Ask, and keeps it disabled after the notice is closed', () => {
    render(<><AskButton category="love" onOpen={() => {}} /><AiUnavailableModal /></>);
    expect(screen.queryByTestId('ai-unavailable-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('ask-button')).toBeEnabled();

    act(() => announceAiUnavailable());
    expect(screen.getByTestId('ai-unavailable-modal')).toHaveTextContent('temporarily unavailable due to usage limits');
    expect(screen.getByTestId('ask-button')).toBeDisabled();

    act(() => closeAiNotice());
    expect(screen.queryByTestId('ai-unavailable-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('ask-button')).toBeDisabled();

    act(() => clearAiUnavailable());
    expect(screen.getByTestId('ask-button')).toBeEnabled();
  });
});
