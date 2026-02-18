import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from '@/services/api-client';

vi.mock('@/services/api-client', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    code: string | undefined;
    constructor(status: number, message: string, code?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  },
}));

import { listIncidents, getIncident, createIncident } from '@/services/incidents';
import * as apiClientModule from '@/services/api-client';
import { CaseState, CasePriority } from '@/types';

const apiFetchMock = () => vi.mocked(apiClientModule.apiFetch);

const emptyResponse = {
  data: { '@odata.count': 0, value: [] },
  headers: new Headers(),
};

describe('listIncidents', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── $select ───────────────────────────────────────────────────────────────

  describe('$select composition', () => {
    beforeEach(() => {
      apiFetchMock().mockResolvedValue(emptyResponse);
    });

    it('includes incidentid in $select', async () => {
      await listIncidents({ page: 1, pageSize: 25 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$select']).toContain('incidentid');
    });

    it('includes ticketnumber in $select', async () => {
      await listIncidents({ page: 1, pageSize: 25 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$select']).toContain('ticketnumber');
    });

    it('includes title in $select', async () => {
      await listIncidents({ page: 1, pageSize: 25 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$select']).toContain('title');
    });

    it('includes statuscode, prioritycode, statecode in $select', async () => {
      await listIncidents({ page: 1, pageSize: 25 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$select']).toContain('statuscode');
      expect(opts.params['$select']).toContain('prioritycode');
      expect(opts.params['$select']).toContain('statecode');
    });

    it('includes createdon and modifiedon in $select', async () => {
      await listIncidents({ page: 1, pageSize: 25 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$select']).toContain('createdon');
      expect(opts.params['$select']).toContain('modifiedon');
    });
  });

  // ── $orderby ──────────────────────────────────────────────────────────────

  it('always orders by modifiedon desc', async () => {
    apiFetchMock().mockResolvedValue(emptyResponse);

    await listIncidents({ page: 1, pageSize: 25 });

    const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(opts.params['$orderby']).toBe('modifiedon desc');
  });

  // ── $top / $skip ──────────────────────────────────────────────────────────

  describe('pagination params', () => {
    beforeEach(() => {
      apiFetchMock().mockResolvedValue(emptyResponse);
    });

    it('sets $top to pageSize', async () => {
      await listIncidents({ page: 1, pageSize: 25 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$top']).toBe(25);
    });

    it('calculates $skip as (page - 1) * pageSize', async () => {
      await listIncidents({ page: 3, pageSize: 10 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$top']).toBe(10);
      expect(opts.params['$skip']).toBe(20);
    });

    it('sets $skip to 0 for page 1', async () => {
      await listIncidents({ page: 1, pageSize: 10 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$skip']).toBe(0);
    });
  });

  // ── $count ────────────────────────────────────────────────────────────────

  it('always sets $count=true', async () => {
    apiFetchMock().mockResolvedValue(emptyResponse);

    await listIncidents({ page: 1, pageSize: 25 });

    const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(opts.params['$count']).toBe(true);
  });

  // ── $filter composition ───────────────────────────────────────────────────

  describe('$filter composition', () => {
    beforeEach(() => {
      apiFetchMock().mockResolvedValue(emptyResponse);
    });

    it('omits $filter when no optional filters are set', async () => {
      await listIncidents({ page: 1, pageSize: 25 });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$filter']).toBeUndefined();
    });

    it('adds statecode eq filter for status', async () => {
      await listIncidents({ page: 1, pageSize: 25, status: CaseState.Active });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$filter']).toContain('statecode eq 0');
    });

    it('adds prioritycode eq filter for priority', async () => {
      await listIncidents({ page: 1, pageSize: 25, priority: CasePriority.High });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$filter']).toContain('prioritycode eq 1');
    });

    it('adds createdon ge filter for dateFrom', async () => {
      await listIncidents({ page: 1, pageSize: 25, dateFrom: '2026-01-01T00:00:00Z' });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$filter']).toContain('createdon ge 2026-01-01T00:00:00Z');
    });

    it('adds createdon le filter for dateTo', async () => {
      await listIncidents({ page: 1, pageSize: 25, dateTo: '2026-01-31T23:59:59Z' });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$filter']).toContain('createdon le 2026-01-31T23:59:59Z');
    });

    it("adds contains(title,'...') filter for searchText", async () => {
      await listIncidents({ page: 1, pageSize: 25, searchText: 'billing' });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      expect(opts.params['$filter']).toContain("contains(title,'billing')");
    });

    it('combines multiple filters with " and "', async () => {
      await listIncidents({
        page: 1,
        pageSize: 25,
        status: CaseState.Active,
        priority: CasePriority.High,
      });
      const [, opts] = apiFetchMock().mock.calls[0] as [string, { params: Record<string, unknown> }];
      const filter = opts.params['$filter'] as string;
      expect(filter).toContain('statecode eq 0');
      expect(filter).toContain('prioritycode eq 1');
      expect(filter).toContain(' and ');
    });
  });

  // ── PaginatedResponse handling ────────────────────────────────────────────

  describe('PaginatedResponse handling', () => {
    it('returns the value array from the response', async () => {
      const mockData = {
        '@odata.count': 47,
        value: [
          {
            incidentid: 'a1b2c3d4',
            ticketnumber: 'CAS-00142',
            title: 'Unable to access billing portal',
            statuscode: 1,
            prioritycode: 2,
            statecode: 0,
            createdon: '2026-02-10T14:30:00Z',
            modifiedon: '2026-02-15T09:45:00Z',
            description: '',
            casetypecode: 1,
            _customerid_value: 'c-abc-123',
          },
        ],
      };

      apiFetchMock().mockResolvedValue({ data: mockData, headers: new Headers() });

      const result = await listIncidents({ page: 1, pageSize: 25 });

      expect(result.value).toEqual(mockData.value);
      expect(result['@odata.count']).toBe(47);
    });

    it('returns empty value array and zero count when no results', async () => {
      apiFetchMock().mockResolvedValue(emptyResponse);

      const result = await listIncidents({ page: 1, pageSize: 25 });

      expect(result.value).toEqual([]);
      expect(result['@odata.count']).toBe(0);
    });
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  describe('error propagation', () => {
    it('propagates ApiError from apiFetch', async () => {
      const error = new ApiError(403, 'Forbidden');
      apiFetchMock().mockRejectedValue(error);

      await expect(listIncidents({ page: 1, pageSize: 25 })).rejects.toBeInstanceOf(ApiError);
    });

    it('propagates 401 Unauthorized error', async () => {
      apiFetchMock().mockRejectedValue(new ApiError(401, 'Unauthorized'));

      await expect(listIncidents({ page: 1, pageSize: 25 })).rejects.toMatchObject({
        status: 401,
        message: 'Unauthorized',
      });
    });

    it('propagates 403 Forbidden error', async () => {
      apiFetchMock().mockRejectedValue(new ApiError(403, 'Access denied'));

      await expect(listIncidents({ page: 1, pageSize: 25 })).rejects.toMatchObject({
        status: 403,
        message: 'Access denied',
      });
    });
  });
});

describe('getIncident', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches incident by id with full detail $select fields', async () => {
    apiFetchMock().mockResolvedValue({
      data: {
        incidentid: 'a1b2c3d4',
        ticketnumber: 'CAS-00142',
        title: 'Unable to access billing portal',
        description: 'Cannot log in to billing portal',
        statuscode: 1,
        prioritycode: 2,
        statecode: 0,
        createdon: '2026-02-10T14:30:00Z',
        modifiedon: '2026-02-15T09:45:00Z',
        casetypecode: 1,
        _customerid_value: 'c-abc-123',
        _ownerid_value: 'o-xyz-789',
      },
      headers: new Headers(),
    });

    await getIncident('a1b2c3d4');

    expect(apiFetchMock()).toHaveBeenCalledWith('/_api/incidents(a1b2c3d4)', {
      params: {
        $select:
          'incidentid,ticketnumber,title,description,statuscode,prioritycode,statecode,createdon,modifiedon,casetypecode,_ownerid_value',
      },
    });
  });

  it('returns incident payload from API response', async () => {
    const detail = {
      incidentid: 'a1b2c3d4',
      ticketnumber: 'CAS-00142',
      title: 'Unable to access billing portal',
      description: 'Cannot log in to billing portal',
      statuscode: 1,
      prioritycode: 2,
      statecode: 0,
      createdon: '2026-02-10T14:30:00Z',
      modifiedon: '2026-02-15T09:45:00Z',
      casetypecode: 1,
      _customerid_value: 'c-abc-123',
      _ownerid_value: 'o-xyz-789',
    };
    apiFetchMock().mockResolvedValue({ data: detail, headers: new Headers() });

    const result = await getIncident('a1b2c3d4');
    expect(result).toEqual(detail);
  });

  it('propagates 403 as authorization error', async () => {
    apiFetchMock().mockRejectedValue(new ApiError(403, 'Forbidden'));

    await expect(getIncident('a1b2c3d4')).rejects.toMatchObject({
      status: 403,
      message: 'Forbidden',
    });
  });

  it('propagates 404 as not-found error', async () => {
    apiFetchMock().mockRejectedValue(new ApiError(404, 'Not Found'));

    await expect(getIncident('a1b2c3d4')).rejects.toMatchObject({
      status: 404,
      message: 'Not Found',
    });
  });
});

describe('createIncident', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('posts CaseCreatePayload including customerid_contact@odata.bind', async () => {
    apiFetchMock().mockResolvedValue({
      data: null,
      headers: new Headers({
        'OData-EntityId':
          'https://example.powerappsportals.com/_api/incidents(a1b2c3d4-e5f6-7890-abcd-ef1234567890)',
      }),
    });

    const payload = {
      title: 'Cannot reset password',
      description: 'Reset flow fails',
      casetypecode: 2,
      prioritycode: 2,
      'customerid_contact@odata.bind': '/contacts(f1e2d3c4-b5a6-7890-abcd-ef1234567890)',
    } as const;

    await createIncident(payload, 'csrf-token');

    expect(apiFetchMock()).toHaveBeenCalledWith('/_api/incidents', {
      method: 'POST',
      body: payload,
      csrfToken: 'csrf-token',
    });
  });

  it('extracts incidentid from OData-EntityId response header', async () => {
    apiFetchMock().mockResolvedValue({
      data: null,
      headers: new Headers({
        'OData-EntityId':
          'https://example.powerappsportals.com/_api/incidents(11111111-2222-3333-4444-555555555555)',
      }),
    });

    const incidentId = await createIncident(
      {
        title: 'Cannot reset password',
        description: 'Reset flow fails',
        casetypecode: 2,
        'customerid_contact@odata.bind': '/contacts(f1e2d3c4-b5a6-7890-abcd-ef1234567890)',
      },
      'csrf-token'
    );

    expect(incidentId).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('throws when OData-EntityId header is missing', async () => {
    apiFetchMock().mockResolvedValue({
      data: null,
      headers: new Headers(),
    });

    await expect(
      createIncident(
        {
          title: 'Cannot reset password',
          description: 'Reset flow fails',
          casetypecode: 2,
          'customerid_contact@odata.bind': '/contacts(f1e2d3c4-b5a6-7890-abcd-ef1234567890)',
        },
        'csrf-token'
      )
    ).rejects.toThrow(/missing OData-EntityId/i);
  });
});
