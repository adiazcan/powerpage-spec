import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

describe('useAntiForgeryToken', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initially returns null before the fetch resolves', async () => {
    let resolveText!: (v: string) => void;
    const textPromise = new Promise<string>((res) => {
      resolveText = res;
    });

    vi.spyOn(global, 'fetch').mockReturnValue(
      Promise.resolve({
        ok: true,
        text: () => textPromise,
      } as unknown as Response)
    );

    const { useAntiForgeryToken } = await import('@/hooks/useAntiForgeryToken');
    const { result } = renderHook(() => useAntiForgeryToken());

    expect(result.current).toBeNull();

    resolveText('<input name="__RequestVerificationToken" type="hidden" value="tok-123" />');
    await waitFor(() => expect(result.current).toBe('tok-123'));
  });

  it('fetches from /_layout/tokenhtml and returns the parsed token value', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          '<input name="__RequestVerificationToken" type="hidden" value="csrf-abc-123" />'
        ),
    } as unknown as Response);

    const { useAntiForgeryToken } = await import('@/hooks/useAntiForgeryToken');
    const { result } = renderHook(() => useAntiForgeryToken());

    await waitFor(() => expect(result.current).toBe('csrf-abc-123'));
    expect(fetchSpy).toHaveBeenCalledWith('/_layout/tokenhtml');
  });

  it('caches the result — only fetches once across multiple hook instances', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<input type="hidden" value="cached-token-xyz" />'),
    } as unknown as Response);

    const { useAntiForgeryToken } = await import('@/hooks/useAntiForgeryToken');

    const { result: r1 } = renderHook(() => useAntiForgeryToken());
    const { result: r2 } = renderHook(() => useAntiForgeryToken());

    await waitFor(() => expect(r1.current).toBe('cached-token-xyz'));
    await waitFor(() => expect(r2.current).toBe('cached-token-xyz'));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
