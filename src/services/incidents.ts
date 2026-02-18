import { apiFetch } from '@/services/api-client';
import type { Case, CaseCreatePayload, TicketListFilters, PaginatedResponse } from '@/types';

const INCIDENTS_URL = '/_api/incidents';

const LIST_SELECT = [
  'incidentid',
  'ticketnumber',
  'title',
  'statuscode',
  'prioritycode',
  'statecode',
  'createdon',
  'modifiedon',
].join(',');

const DETAIL_SELECT = [
  'incidentid',
  'ticketnumber',
  'title',
  'description',
  'statuscode',
  'prioritycode',
  'statecode',
  'createdon',
  'modifiedon',
  'casetypecode',
  '_ownerid_value',
].join(',');

/**
 * Fetches a paginated list of incidents for the authenticated contact.
 * Data scoping (contact/account visibility) is enforced server-side by Power Pages table permissions.
 *
 * Power Pages OData does not support $skip. For pages beyond the first, pass the
 * `nextLink` returned by the previous page's response so the server can apply its
 * own skip-token-based cursor.
 */
export async function listIncidents(
  filters: TicketListFilters,
  nextLink?: string
): Promise<PaginatedResponse<Case>> {
  // When the API returns @odata.nextLink, use it directly for subsequent pages.
  if (nextLink) {
    const result = await apiFetch<PaginatedResponse<Case>>(nextLink, {});
    return result.data;
  }

  const { status, priority, dateFrom, dateTo, searchText, pageSize } = filters;

  const filterParts: string[] = [];
  if (status !== undefined) filterParts.push(`statecode eq ${status}`);
  if (priority !== undefined) filterParts.push(`prioritycode eq ${priority}`);
  if (dateFrom) filterParts.push(`createdon ge ${dateFrom}`);
  if (dateTo) filterParts.push(`createdon le ${dateTo}`);
  if (searchText) filterParts.push(`contains(title,'${searchText}')`);

  const params: Record<string, string | number | boolean | undefined> = {
    $select: LIST_SELECT,
    $orderby: 'modifiedon desc',
    $top: pageSize,
    $count: true,
    $filter: filterParts.length > 0 ? filterParts.join(' and ') : undefined,
  };

  const result = await apiFetch<PaginatedResponse<Case>>(INCIDENTS_URL, { params });
  return result.data;
}

export async function getIncident(incidentId: string): Promise<Case> {
  const result = await apiFetch<Case>(`${INCIDENTS_URL}(${incidentId})`, {
    params: {
      $select: DETAIL_SELECT,
    },
  });

  return result.data;
}

export async function createIncident(
  payload: CaseCreatePayload,
  csrfToken: string
): Promise<string> {
  const result = await apiFetch<null>(INCIDENTS_URL, {
    method: 'POST',
    body: payload,
    csrfToken,
  });

  const entityIdHeader = result.headers.get('OData-EntityId');
  if (!entityIdHeader) {
    throw new Error('Incident creation response is missing OData-EntityId header.');
  }

  const match = entityIdHeader.match(/incidents\(([^)]+)\)/i);
  if (!match?.[1]) {
    throw new Error('Unable to parse incident ID from OData-EntityId header.');
  }

  return match[1];
}
