import type React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicFrame from './PublicFrame';

const at = (path: string, nav?: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PublicFrame nav={nav}>
        <p>page</p>
      </PublicFrame>
    </MemoryRouter>
  );

describe('the visit log on the public frame', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ visitId: 'v1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(async () => {
    // the visit request hashes its body first, so let it land on this test's fetch and not the next one's
    await new Promise((r) => setTimeout(r, 50));
    vi.unstubAllGlobals();
  });

  it('adds no text box: the assistant will be voice only', () => {
    at('/');
    expect(screen.getByText('page')).toBeInTheDocument();
    expect(document.querySelector('input, textarea')).toBeNull();
  });

  it('logs a visit once per session, with the hash the API needs', async () => {
    at('/');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/assistant/visit');
    expect((init.headers as Record<string, string>)['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
    await waitFor(() => expect(localStorage.getItem('aa_visit')).toBe('v1'));
    at('/pricing');
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['/signin', '/signin/', '/signup/details'])('does not log a visit on %s', async (path) => {
    at(path);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not log someone signed in', async () => {
    at('/pricing', <nav>signed-in nav</nav>);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the page carries on when the log fails', async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error('network');
    });
    at('/');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('page')).toBeInTheDocument();
  });
});
