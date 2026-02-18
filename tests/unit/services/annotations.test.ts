import { describe, it, expect, vi, afterEach } from 'vitest';
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

import * as apiClientModule from '@/services/api-client';
import { listAnnotations, getAnnotation, createAnnotation } from '@/services/annotations';

const apiFetchMock = () => vi.mocked(apiClientModule.apiFetch);

describe('listAnnotations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('filters by _objectid_value and isdocument flag', async () => {
    apiFetchMock().mockResolvedValue({ data: { value: [] }, headers: new Headers() });

    await listAnnotations('inc-123');

    expect(apiFetchMock()).toHaveBeenCalledWith('/_api/annotations', {
      params: {
        $select: 'annotationid,subject,notetext,filename,mimetype,isdocument,createdon',
        $filter: '_objectid_value eq inc-123 and isdocument eq true',
        $orderby: 'createdon asc',
      },
    });
  });

  it('returns annotation summary list', async () => {
    const response = {
      value: [
        {
          annotationid: 'ann-1',
          subject: 'Attachment',
          notetext: '',
          filename: 'error-log.txt',
          mimetype: 'text/plain',
          isdocument: true,
          createdon: '2026-02-10T14:30:00Z',
        },
      ],
    };
    apiFetchMock().mockResolvedValue({ data: response, headers: new Headers() });

    const result = await listAnnotations('inc-123');

    expect(result).toEqual(response.value);
  });
});

describe('getAnnotation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches full annotation including documentbody', async () => {
    apiFetchMock().mockResolvedValue({
      data: {
        annotationid: 'ann-1',
        subject: 'Attachment',
        notetext: '',
        filename: 'error-log.txt',
        mimetype: 'text/plain',
        documentbody: 'SGVsbG8=',
        isdocument: true,
        createdon: '2026-02-10T14:30:00Z',
      },
      headers: new Headers(),
    });

    await getAnnotation('ann-1');

    expect(apiFetchMock()).toHaveBeenCalledWith('/_api/annotations(ann-1)', {
      params: {
        $select:
          'annotationid,subject,notetext,filename,mimetype,documentbody,isdocument,createdon',
      },
    });
  });

  it('returns annotation including documentbody', async () => {
    const response = {
      annotationid: 'ann-1',
      subject: 'Attachment',
      notetext: '',
      filename: 'error-log.txt',
      mimetype: 'text/plain',
      documentbody: 'SGVsbG8=',
      isdocument: true,
      createdon: '2026-02-10T14:30:00Z',
    };
    apiFetchMock().mockResolvedValue({ data: response, headers: new Headers() });

    const result = await getAnnotation('ann-1');

    expect(result).toEqual(response);
  });
});

describe('createAnnotation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('posts payload with base64 documentbody and objectid@odata.bind', async () => {
    apiFetchMock().mockResolvedValue({ data: null, headers: new Headers() });

    const payload = {
      subject: 'Customer attachment',
      filename: 'screenshot.png',
      mimetype: 'image/png',
      documentbody: 'iVBORw0KGgoAAAANSUhEUg...',
      'objectid@odata.bind': '/incidents(inc-123)',
    } as const;

    await createAnnotation(payload, 'csrf-token');

    expect(apiFetchMock()).toHaveBeenCalledWith('/_api/annotations', {
      method: 'POST',
      body: payload,
      csrfToken: 'csrf-token',
    });
  });

  it('propagates 400 validation errors', async () => {
    apiFetchMock().mockRejectedValue(new ApiError(400, 'Validation failed'));

    await expect(
      createAnnotation(
        {
          filename: 'screenshot.png',
          mimetype: 'image/png',
          documentbody: 'iVBORw0KGgoAAAANSUhEUg...',
          'objectid@odata.bind': '/incidents(inc-123)',
        },
        'csrf-token'
      )
    ).rejects.toMatchObject({ status: 400, message: 'Validation failed' });
  });
});