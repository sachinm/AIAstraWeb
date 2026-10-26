import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/apiHeaders', () => ({ buildApiHeaders: vi.fn(async () => ({ 'Content-Type': 'application/json' })) }));
vi.mock('../lib/graphql', () => ({ runGraphQL: vi.fn(), getUserId: vi.fn() }));

import { answerClarify } from './UserData';

describe('answerClarify', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ type: 'propose', runId: 'r1', exactQuery: 'I will read: …', assumed: null }) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sends the browser timezone with the location answer', async () => {
    await answerClarify('r1', 'Toronto, Canada', false, { tz: 'America/Toronto' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/chat\/answer$/);
    expect(JSON.parse(init.body)).toEqual({ runId: 'r1', value: 'Toronto, Canada', viaChip: false, tz: 'America/Toronto' });
  });

  it('other answers carry no timezone', async () => {
    await answerClarify('r1', 'elder_brother', true);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ runId: 'r1', value: 'elder_brother', viaChip: true });
  });
});
