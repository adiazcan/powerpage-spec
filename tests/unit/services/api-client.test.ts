import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '@/services/api-client';

function mockResponse(
  status: number,
  body?: unknown,
  headers?: Record<string, string>
): Response {
  const resHeaders = new Headers(headers ?? {});
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: resHeaders,
    json: () => Promise.resolve(body),
    text: () =>
      Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe('apiFetch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch') as unknown as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── CSRF header injection ─────────────────────────────────────────────────

  describe('CSRF header injection', () => {
    it('injects __RequestVerificationToken on POST', async () => {
      fetchSpy.mockResolvedValue(mockResponse(204, null, {}));

      await apiFetch('/test', { method: 'POST', csrfToken: 'tok', body: {} });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['__RequestVerificationToken']).toBe('tok');
    });

    it('injects __RequestVerificationToken on PATCH', async () => {
      fetchSpy.mockResolvedValue(mockResponse(204, null, {}));

      await apiFetch('/test', { method: 'PATCH', csrfToken: 'tok', body: {} });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['__RequestVerificationToken']).toBe('tok');
    });

    it('injects __RequestVerificationToken on DELETE', async () => {
      fetchSpy.mockResolvedValue(mockResponse(204, null, {}));

      await apiFetch('/test', { method: 'DELETE', csrfToken: 'tok' });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['__RequestVerificationToken']).toBe('tok');
    });

    it('does NOT inject CSRF header on GET', async () => {
      fetchSpy.mockResolvedValue(mockResponse(200, { value: [] }));

      await apiFetch('/test', { csrfToken: 'tok' });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['__RequestVerificationToken']).toBeUndefined();
    });
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  describe('error propagation', () => {
    it('throws ApiError with status 401 on Unauthorized', async () => {
      fetchSpy.mockResolvedValue(
        mockResponse(401, { error: { code: 'Unauthorized', message: 'Session expired' } })
      );

      await expect(apiFetch('/test')).rejects.toMatchObject({
        status: 401,
        message: 'Session expired',
      });
    });

    it('throws ApiError with status 403 on Forbidden', async () => {
      fetchSpy.mockResolvedValue(
        mockResponse(403, { error: { code: 'Forbidden', message: 'Access denied' } })
      );

      await expect(apiFetch('/test')).rejects.toMatchObject({
        status: 403,
        message: 'Access denied',
      });
    });

    it('parses OData error code and message from error response body', async () => {
      fetchSpy.mockResolvedValue(
        mockResponse(400, { error: { code: '0x80040265', message: 'Required field: title' } })
      );

      await expect(apiFetch('/test')).rejects.toMatchObject({
        status: 400,
        message: 'Required field: title',
        code: '0x80040265',
      });
    });

    it('falls back to generic HTTP message for non-JSON error response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.reject(new SyntaxError('Unexpected end of JSON')),
      } as unknown as Response);

      await expect(apiFetch('/test')).rejects.toMatchObject({
        status: 500,
        message: 'HTTP 500',
      });
    });

    it('throws an instance of ApiError', async () => {
      fetchSpy.mockResolvedValue(mockResponse(403, {}));

      await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    });
  });

  // ── Query params ──────────────────────────────────────────────────────────

  describe('query params', () => {
    it('appends defined params to the URL as a query string', async () => {
      fetchSpy.mockResolvedValue(mockResponse(200, { value: [] }));

      await apiFetch('/_api/incidents', {
        params: { $select: 'title,statuscode', $top: 25, $count: true },
      });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('$select=');
      expect(url).toContain('title');
      expect(url).toContain('statuscode');
      expect(url).toContain('$top=25');
      expect(url).toContain('$count=true');
    });

    it('omits undefined param values', async () => {
      fetchSpy.mockResolvedValue(mockResponse(200, { value: [] }));

      await apiFetch('/_api/incidents', {
        params: { $top: 10, $skip: undefined },
      });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('$top=10');
      expect(url).not.toContain('$skip');
    });
  });

  // ── Response handling ─────────────────────────────────────────────────────

  describe('response handling', () => {
    it('returns parsed JSON data and response headers', async () => {
      const responseHeaders = new Headers({ 'OData-Version': '4.0' });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        headers: responseHeaders,
        json: () => Promise.resolve({ value: [{ incidentid: 'abc' }] }),
      } as unknown as Response);

      const result = await apiFetch('/_api/incidents');
      expect(result.data).toEqual({ value: [{ incidentid: 'abc' }] });
      expect(result.headers).toBe(responseHeaders);
    });

    it('returns null data with headers for 204 No Content', async () => {
      const responseHeaders = new Headers({ 'OData-EntityId': 'incidents(123)' });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 204,
        headers: responseHeaders,
        json: () => Promise.reject(new Error('no body on 204')),
      } as unknown as Response);

      const result = await apiFetch('/test', {
        method: 'POST',
        csrfToken: 'tok',
        body: {},
      });

      expect(result.data).toBeNull();
      expect(result.headers).toBe(responseHeaders);
    });
  });
});
