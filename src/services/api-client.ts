// Base fetch wrapper for the Power Pages Web API (/_api/).
// Responsibilities:
//   - Append OData query params to the URL
//   - Inject __RequestVerificationToken header on write operations (POST/PATCH/DELETE)
//   - Parse OData error responses into typed ApiError exceptions
//   - Propagate 401/403 as ApiError so callers can react uniformly

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

export interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  /** CSRF token from useAntiForgeryToken — required for write operations. */
  csrfToken?: string;
  /** OData query params ($select, $filter, $orderby, $top, $skip, $count, …). */
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiFetchResult<T> {
  data: T;
  headers: Headers;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<ApiFetchResult<T>> {
  const { method = 'GET', body, csrfToken, params } = options;

  // Build the full URL with query params.
  // Keys are appended verbatim (preserving OData $ prefix); values are percent-encoded.
  let fullUrl = url;
  if (params) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        parts.push(`${key}=${encodeURIComponent(String(value))}`);
      }
    }
    if (parts.length > 0) {
      fullUrl = `${url}?${parts.join('&')}`;
    }
  }

  // Build request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
  };

  if (WRITE_METHODS.has(method.toUpperCase()) && csrfToken) {
    headers['__RequestVerificationToken'] = csrfToken;
  }

  const response = await fetch(fullUrl, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    let code: string | undefined;

    try {
      const errBody = (await response.json()) as {
        error?: { message?: string; code?: string };
      };
      if (errBody?.error?.message) {
        message = errBody.error.message;
        code = errBody.error.code;
      }
    } catch {
      // Non-JSON error — use generic message
    }

    throw new ApiError(response.status, message, code);
  }

  // 204 No Content — no body to parse (e.g. POST / PATCH / DELETE success)
  if (response.status === 204) {
    return { data: null as T, headers: response.headers };
  }

  const data = (await response.json()) as T;
  return { data, headers: response.headers };
}
