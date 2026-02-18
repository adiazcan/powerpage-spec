import { apiFetch } from '@/services/api-client';
import type { Activity, PaginatedResponse } from '@/types';

const ACTIVITIES_URL = '/_api/activitypointers';

const SELECT_FIELDS = 'activityid,subject,description,activitytypecode,createdon';

export async function listActivities(incidentId: string): Promise<Activity[]> {
  const result = await apiFetch<PaginatedResponse<Activity>>(ACTIVITIES_URL, {
    params: {
      $select: SELECT_FIELDS,
      $filter: `_regardingobjectid_value eq ${incidentId}`,
      $orderby: 'createdon asc',
    },
  });

  return result.data.value;
}