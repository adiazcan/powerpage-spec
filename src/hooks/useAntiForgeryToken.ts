import { useState, useEffect } from 'react';

// Module-level cache so multiple hook instances share a single token fetch.
let cachedToken: string | null = null;
let fetchInProgress = false;
const pendingResolvers: Array<(token: string | null) => void> = [];

async function loadToken(): Promise<string | null> {
  // Return immediately if already cached
  if (cachedToken) return cachedToken;

  // Queue this call to be resolved when the in-flight request completes
  if (fetchInProgress) {
    return new Promise<string | null>((resolve) => {
      pendingResolvers.push(resolve);
    });
  }

  fetchInProgress = true;
  let token: string | null = null;

  try {
    const response = await fetch('/_layout/tokenhtml');
    const html = await response.text();
    // Power Pages renders a hidden input whose `value` is the CSRF token.
    const match = html.match(/value="([^"]+)"/);
    if (match?.[1]) {
      cachedToken = match[1];
      token = cachedToken;
    }
  } catch {
    // Network failure — token stays null; callers will retry on next mount.
  } finally {
    fetchInProgress = false;
    // Resolve all queued callers
    for (const resolve of pendingResolvers) {
      resolve(token);
    }
    pendingResolvers.length = 0;
  }

  return token;
}

/**
 * Returns the Power Pages anti-forgery token, fetching it once from
 * `/_layout/tokenhtml` and caching the result for the lifetime of the module.
 *
 * Returns null until the token is available.
 */
export function useAntiForgeryToken(): string | null {
  const [token, setToken] = useState<string | null>(cachedToken);

  useEffect(() => {
    // If already cached (e.g. after first fetch), sync state immediately.
    if (cachedToken) {
      setToken(cachedToken);
      return;
    }

    loadToken().then((tok) => {
      if (tok) setToken(tok);
    });
  }, []);

  return token;
}
