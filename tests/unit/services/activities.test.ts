import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/services/api-client', () => ({
  apiFetch: vi.fn(),
}));

import * as apiClientModule from '@/services/api-client';
import { listActivities } from '@/services/activities';

const apiFetchMock = () => vi.mocked(apiClientModule.apiFetch);

describe('listActivities', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('filters by _regardingobjectid_value and orders by createdon asc', async () => {
    apiFetchMock().mockResolvedValue({ data: { value: [] }, headers: new Headers() });

    await listActivities('inc-123');

    expect(apiFetchMock()).toHaveBeenCalledWith('/_api/activitypointers', {
      params: {
        $select: 'activityid,subject,description,activitytypecode,createdon',
        $filter: '_regardingobjectid_value eq inc-123',
        $orderby: 'createdon asc',
      },
    });
  });

  it('maps API response to Activity[] shape', async () => {
    const response = {
      value: [
        {
          activityid: 'act-1',
          subject: 'Case opened',
          description: 'Customer reported issue',
          activitytypecode: 'email',
          createdon: '2026-02-10T14:30:00Z',
        },
      ],
    };
    apiFetchMock().mockResolvedValue({ data: response, headers: new Headers() });

    const result = await listActivities('inc-123');

    expect(result).toEqual(response.value);
  });
});