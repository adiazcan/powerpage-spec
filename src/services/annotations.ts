import { apiFetch } from '@/services/api-client';
import type { Annotation, AnnotationCreatePayload, PaginatedResponse } from '@/types';

const ANNOTATIONS_URL = '/_api/annotations';

const LIST_SELECT = 'annotationid,subject,notetext,filename,mimetype,isdocument,createdon';
const DETAIL_SELECT =
  'annotationid,subject,notetext,filename,mimetype,documentbody,isdocument,createdon';

export async function listAnnotations(incidentId: string): Promise<Annotation[]> {
  const result = await apiFetch<PaginatedResponse<Annotation>>(ANNOTATIONS_URL, {
    params: {
      $select: LIST_SELECT,
      $filter: `_objectid_value eq ${incidentId} and isdocument eq true`,
      $orderby: 'createdon asc',
    },
  });

  return result.data.value;
}

export async function getAnnotation(annotationId: string): Promise<Annotation> {
  const result = await apiFetch<Annotation>(`${ANNOTATIONS_URL}(${annotationId})`, {
    params: {
      $select: DETAIL_SELECT,
    },
  });

  return result.data;
}

export async function createAnnotation(
  payload: AnnotationCreatePayload,
  csrfToken: string
): Promise<void> {
  await apiFetch<null>(ANNOTATIONS_URL, {
    method: 'POST',
    body: payload,
    csrfToken,
  });
}