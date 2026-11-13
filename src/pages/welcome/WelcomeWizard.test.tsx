import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { judgeFrame, loadDetector, Steadiness, STEADY_FRAMES, toFractions } from '../../lib/faceGate';

vi.mock('./SelfieStep', () => ({
  default: ({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) => (
    <div data-testid="selfie-step">
      <button type="button" onClick={onDone}>
        stub-photo
      </button>
      <button type="button" onClick={onSkip}>
        stub-skip
      </button>
    </div>
  ),
}));

import WelcomeWizard from './WelcomeWizard';
import TopNavigation from '../TopNavigation';

let saved: Array<Record<string, string | null>>;
beforeEach(() => {
  localStorage.setItem('token', 't');
  saved = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.endsWith('/api/profile/facts') && init.method === 'PUT') saved.push(JSON.parse(String(init.body)).facts);
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('face gate (docs/reading-engine/52 §4)', () => {
  const good = { x: 0.3, y: 0.25, w: 0.4, h: 0.5, score: 0.95 };
  it('needs exactly one large, central, confident face', () => {
    expect(judgeFrame([]).hint).toBe('no_face');
    expect(judgeFrame([good, { ...good, x: 0.1 }]).hint).toBe('many_faces');
    expect(judgeFrame([{ ...good, w: 0.1 }]).hint).toBe('too_far');
    expect(judgeFrame([{ ...good, x: 0.7 }]).hint).toBe('off_centre');
    expect(judgeFrame([{ ...good, score: 0.4 }]).hint).toBe('no_face');
    expect(judgeFrame([good])).toEqual({ hint: 'ok', box: good });
  });
  it('is ready only after enough steady frames, and resets on a bad one', () => {
    const s = new Steadiness();
    for (let i = 1; i < STEADY_FRAMES; i++) expect(s.push(true)).toBe(false);
    expect(s.push(true)).toBe(true);
    expect(s.push(false)).toBe(false);
    expect(s.count).toBe(0);
  });
  it('turns detector pixels into fractions', () => {
    expect(toFractions({ detections: [{ boundingBox: { originX: 100, originY: 50, width: 200, height: 250 }, categories: [{ score: 0.9 }] }] }, 500, 500)).toEqual([{ x: 0.2, y: 0.1, w: 0.4, h: 0.5, score: 0.9 }]);
  });
  it('falls back to null when @mediapipe/tasks-vision is unavailable', async () => {
    // the package may be installed; with it, jsdom waits on its wasm files and never settles, so it is made missing here
    vi.doMock('@mediapipe/tasks-vision', () => {
      throw new Error('unavailable');
    });
    try {
      await expect(loadDetector()).resolves.toBeNull();
    } finally {
      vi.doUnmock('@mediapipe/tasks-vision');
    }
  });
});

describe('personalization wizard', () => {
  it('walks every step, stores answers and "rather not say", and finishes', async () => {
    const onFinish = vi.fn();
    render(<WelcomeWizard onFinish={onFinish} />);
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'stub-photo' }));

    fireEvent.change(await screen.findByLabelText('City, country'), { target: { value: 'Pune, India' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByTestId('step-work');
    fireEvent.click(screen.getByRole('button', { name: 'Between jobs' }));
    fireEvent.click(screen.getAllByRole('button', { name: "I'd rather not say" })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByTestId('step-love');
    fireEvent.click(screen.getByRole('button', { name: 'Married' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByTestId('step-family');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByTestId('step-focus');
    for (const k of ['Career', 'Love', 'Travel', 'Health']) fireEvent.click(screen.getByRole('button', { name: k }));
    expect(screen.getByRole('button', { name: 'Health' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(saved).toEqual([
      { 'place.current': 'Pune, India' },
      { 'work.status': 'between_jobs', 'work.level': null },
      { 'love.status': 'married' },
      { 'self.focus': 'career,love,travel' },
      { 'wizard.done': expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    ]);
  });
  it('Skip for now leaves at once and stores only that it was skipped', async () => {
    const onFinish = vi.fn();
    render(<WelcomeWizard onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(saved).toEqual([{ 'wizard.skipped': expect.stringMatching(/^\d{4}-/) }]);
  });
  it('opens from the avatar menu Personalize setup as a modal, and the header has no separate Personalize button', async () => {
    render(
      <MemoryRouter>
        <TopNavigation user={{ name: 'Sachin', email: 's@example.com' }} onLogout={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('header-wizard-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-tabs')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
    fireEvent.click(screen.getByTestId('menu-personalize-wizard'));

    const modal = await screen.findByTestId('header-wizard-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId('welcome-wizard')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('header-wizard-close'));
    expect(screen.queryByTestId('header-wizard-modal')).not.toBeInTheDocument();
  });

  it('supports stepping backward with ← Back, renders 2-column grid on multi-question steps, and displays technique badges', async () => {
    const onFinish = vi.fn();
    render(<WelcomeWizard onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'stub-photo' }));

    // Step 2: Where you are
    expect(await screen.findByTestId('step-place')).toBeInTheDocument();
    expect(screen.getByTestId('question-technique-badge')).toHaveTextContent('lucky.day_tables');
    fireEvent.click(screen.getByTestId('wizard-back'));
    expect(await screen.findByTestId('selfie-step')).toBeInTheDocument();

    // Advance to Step 3: Work (2 questions -> 2-column grid)
    fireEvent.click(screen.getByRole('button', { name: 'stub-photo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findByTestId('step-work');
    const grid = screen.getByTestId('wizard-questions-grid');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(screen.getAllByTestId('question-technique-badge')).toHaveLength(2);

    // Step back from Step 3 to Step 2
    fireEvent.click(screen.getByTestId('wizard-back'));
    expect(await screen.findByTestId('step-place')).toBeInTheDocument();
  });

  it('SelfieStep enables Take photo and shows Upload photo when webcam stream is active even if MediaPipe detector is null', async () => {
    const actual = await vi.importActual<typeof import('./SelfieStep')>('./SelfieStep');
    const RealSelfieStep = actual.default;
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: stopTrack }],
        })),
      },
    });
    HTMLMediaElement.prototype.play = vi.fn(async () => undefined);

    const onDone = vi.fn();
    const onSkip = vi.fn();
    render(<RealSelfieStep onDone={onDone} onSkip={onSkip} />);

    const takeBtn = await screen.findByRole('button', { name: 'Take photo' });
    await waitFor(() => expect(takeBtn).not.toBeDisabled());
    expect(screen.getByTestId('selfie-hint')).not.toHaveTextContent('The camera is not available here');
    expect(screen.getByTestId('selfie-upload-btn')).toBeInTheDocument();
    expect(screen.getByTestId('question-technique-badge')).toHaveTextContent('companion.wizard');
  });
});
