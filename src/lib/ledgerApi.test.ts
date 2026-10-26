import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLedgerEvent,
  deleteLedgerEvent,
  fetchLedgerEvents,
  fetchLedgerMeta,
  humaniseCode,
  LedgerApiError,
  runLedgerInterview,
  updateLedgerEvent,
} from './ledgerApi';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ledgerApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.setItem('token', 'tok');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sends the bearer token on both auth headers', async () => {
    fetchMock.mockResolvedValue(json(200, { kundliId: 'k', events: [] }));
    await fetchLedgerEvents();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/timeline\/ledger$/);
    expect(init.method).toBe('GET');
    expect(init.headers['X-Astra-Authorization']).toBe('Bearer tok');
    expect(init.headers['Authorization']).toBe('Bearer tok');
    expect(init.body).toBeUndefined();
  });

  it('passes kundliId as a query parameter when given', async () => {
    fetchMock.mockResolvedValue(json(200, { kundliId: 'k', events: [] }));
    await fetchLedgerEvents('k 1');
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\?kundliId=k%201$/);
  });

  it('returns null meta on 404 (feature off)', async () => {
    fetchMock.mockResolvedValue(new Response('Not found', { status: 404 }));
    await expect(fetchLedgerMeta()).resolves.toBeNull();
  });

  it('returns meta when on', async () => {
    const meta = { markers: [], attributes: [], precisions: ['day', 'month', 'year'], years: 18, interview: false };
    fetchMock.mockResolvedValue(json(200, meta));
    await expect(fetchLedgerMeta()).resolves.toEqual(meta);
  });

  it('POSTs a new event with a content hash and returns it', async () => {
    const event = { id: 'e1', category: 'relocation', date: '2014-03-01', date_precision: 'month', place: null, attributes: {} };
    fetchMock.mockResolvedValue(json(201, { event }));
    const out = await createLedgerEvent({ category: 'relocation', date: '2014-03', date_precision: 'month' });
    expect(out).toEqual(event);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ category: 'relocation', date: '2014-03', date_precision: 'month' });
    expect(init.headers['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('turns a 400 into a LedgerApiError carrying the field', async () => {
    fetchMock.mockResolvedValue(json(400, { error: 'future_date', field: 'date' }));
    const err = await createLedgerEvent({ category: 'x', date: '2999', date_precision: 'year' }).catch((e) => e);
    expect(err).toBeInstanceOf(LedgerApiError);
    expect(err.status).toBe(400);
    expect(err.field).toBe('date');
    expect(err.message).toBe('Future date.');
  });

  it('PATCHes and DELETEs by id', async () => {
    const event = { id: 'e/1', category: 'relocation', date: '2014-01-01', date_precision: 'year', place: null, attributes: {} };
    fetchMock.mockResolvedValueOnce(json(200, { event })).mockResolvedValueOnce(json(200, { ok: true }));
    await updateLedgerEvent('e/1', { place: 'Pune' });
    await deleteLedgerEvent('e/1');
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/api\/timeline\/ledger\/e%2F1$/);
    expect(fetchMock.mock.calls[0]![1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[1]![1].method).toBe('DELETE');
  });

  it('returns interview proposals, or the declined reply with none', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { proposals: [{ proposalId: 'p1' }] }));
    const a = await runLedgerInterview('moved to Pune', 2014);
    expect(a.proposals).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ text: 'moved to Pune', year: 2014 });

    fetchMock.mockResolvedValueOnce(json(200, { proposals: [], declined: { reply: 'I cannot help with that here.' } }));
    const b = await runLedgerInterview('x');
    expect(b).toEqual({ proposals: [], declined: { reply: 'I cannot help with that here.' } });
  });

  it('maps 503 codes to plain messages', async () => {
    fetchMock.mockResolvedValue(json(503, { error: 'interview_unavailable' }));
    const err = await runLedgerInterview('x').catch((e) => e);
    expect(err.status).toBe(503);
    expect(err.message).toMatch(/not available right now/);
  });

  it('fails as 401 without a token and does not call fetch', async () => {
    localStorage.clear();
    const err = await fetchLedgerEvents().catch((e) => e);
    expect(err.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('humaniseCode', () => {
  it('turns snake codes into sentences and leaves text alone', () => {
    expect(humaniseCode('unknown_category')).toBe('Unknown category.');
    expect(humaniseCode('Date is in the future')).toBe('Date is in the future');
  });
});
