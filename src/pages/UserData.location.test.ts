import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/apiHeaders', () => ({ buildApiHeaders: vi.fn(async () => ({ 'Content-Type': 'application/json' })) }));
vi.mock('../lib/graphql', () => ({ runGraphQL: vi.fn(), getUserId: vi.fn() }));

import { confirmClarifyStream, locationFields, sendChatMessageStream } from './UserData';

describe('question location in stream bodies', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    // the body is all these tests need; a failed response ends the stream call early
    fetchMock.mockReset().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const loc = { lat: 43.65, lon: -79.38, tz: 'America/Toronto' };

  it('ask-stream carries lat, lon, tz when given', async () => {
    await sendChatMessageStream('Will I get the job?', 'c1', () => {}, { location: loc }).catch(() => undefined);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/chat\/ask-stream$/);
    expect(JSON.parse(init.body)).toMatchObject({ question: 'Will I get the job?', lat: 43.65, lon: -79.38, tz: 'America/Toronto' });
  });

  it('ask-stream has no location fields without a location', async () => {
    await sendChatMessageStream('Will I get the job?', 'c1', () => {}, { location: null }).catch(() => undefined);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).not.toHaveProperty('lat');
    expect(body).not.toHaveProperty('lon');
    expect(body).not.toHaveProperty('tz');
  });

  it('confirm-stream carries lat, lon, tz when given', async () => {
    await confirmClarifyStream('r1', 'c1', () => {}, { location: loc }).catch(() => undefined);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/chat\/confirm-stream$/);
    expect(JSON.parse(init.body)).toMatchObject({ runId: 'r1', lat: 43.65, lon: -79.38, tz: 'America/Toronto' });
  });

  it('locationFields drops unusable values', () => {
    expect(locationFields(undefined)).toEqual({});
    expect(locationFields({ lat: Number.NaN, lon: 1 })).toEqual({});
    expect(locationFields({ lat: 1, lon: 2 })).toEqual({ lat: 1, lon: 2 });
  });
});
