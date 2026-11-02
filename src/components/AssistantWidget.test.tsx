import type React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicFrame from './PublicFrame';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const at = (path: string, nav?: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PublicFrame nav={nav}>
        <p>page</p>
      </PublicFrame>
    </MemoryRouter>
  );

describe('the assistant on the public pages', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn(async (url: string) =>
      url.includes('/visit') ? json({ visitId: 'v1' }) : json({ answer: 'Yes. A reading looks at work.', verdict: 'yes', cta: true, visitId: 'v1' })
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(async () => {
    // the visit request hashes its body first, so let it land on this test's fetch and not the next one's
    await new Promise((r) => setTimeout(r, 50));
    vi.unstubAllGlobals();
  });

  it.each(['/', '/signup', '/pricing', '/terms', '/privacy', '/refunds'])('is on %s', (path) => {
    at(path);
    expect(document.querySelector('[data-test-id="assistant-open"]')).not.toBeNull();
  });

  it.each(['/signin', '/signin/'])('is not on %s', (path) => {
    at(path);
    expect(document.querySelector('[data-test-id="assistant-open"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is not shown to someone signed in', () => {
    at('/pricing', <nav>signed-in nav</nav>);
    expect(document.querySelector('[data-test-id="assistant-open"]')).toBeNull();
  });

  it('logs the visit once per session, with the hash the API needs', async () => {
    at('/');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/assistant/visit');
    expect((init.headers as Record<string, string>)['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
    await waitFor(() => expect(localStorage.getItem('aa_visit')).toBe('v1'));
    at('/');
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks, shows the answer and offers sign-up', async () => {
    at('/');
    fireEvent.click(document.querySelector('[data-test-id="assistant-open"]') as Element);
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'can you help with my career?' } });
    fireEvent.click(screen.getByLabelText('Send'));
    expect(await screen.findByText('Yes. A reading looks at work.')).toBeInTheDocument();
    expect(screen.getByText('Sign up and read your chart')).toHaveAttribute('href', '/signup');
    expect(screen.getByText(/Questions are logged/)).toBeInTheDocument();
    const ask = fetchMock.mock.calls.find((c) => String(c[0]).includes('/ask'));
    expect(JSON.parse(ask?.[1].body as string)).toMatchObject({ question: 'can you help with my career?', path: '/' });
  });

  it('does not offer sign-up on the sign-up page', async () => {
    at('/signup');
    fireEvent.click(document.querySelector('[data-test-id="assistant-open"]') as Element);
    fireEvent.click(screen.getByText('Can you read my birth chart?'));
    expect(await screen.findByText('Yes. A reading looks at work.')).toBeInTheDocument();
    expect(screen.queryByText('Sign up and read your chart')).toBeNull();
  });

  it('shows the polite answer that comes with a rate limit', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.includes('/visit') ? json({}) : json({ answer: 'You have asked a lot.', cta: true, error: 'too_many' }, 429)));
    at('/');
    fireEvent.click(document.querySelector('[data-test-id="assistant-open"]') as Element);
    fireEvent.click(screen.getByText('What field am I more inclined for?'));
    expect(await screen.findByText('You have asked a lot.')).toBeInTheDocument();
  });

  it('says so when the API fails, and the page carries on', async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error('network');
    });
    at('/');
    fireEvent.click(document.querySelector('[data-test-id="assistant-open"]') as Element);
    fireEvent.click(screen.getByText('What field am I more inclined for?'));
    expect(await screen.findByText(/could not answer just now/)).toBeInTheDocument();
    expect(screen.getByText('page')).toBeInTheDocument();
  });
});
