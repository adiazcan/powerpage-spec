import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

type MicrosoftPortalWindow = Window & {
  Microsoft?: {
    Dynamic365?: {
      Portal?: {
        User?: {
          userName: string;
          firstName: string;
          lastName: string;
          contactId: string;
          accountId?: string;
        };
      };
    };
  };
};

describe('useAuth', () => {
  afterEach(() => {
    delete (window as MicrosoftPortalWindow).Microsoft;
    vi.unstubAllEnvs();
  });

  it('returns PortalUser when window["Microsoft"].Dynamic365.Portal.User is populated', () => {
    (window as MicrosoftPortalWindow).Microsoft = {
      Dynamic365: {
        Portal: {
          User: {
            userName: 'alice@contoso.com',
            firstName: 'Alice',
            lastName: 'Smith',
            contactId: 'c-abc-123',
            accountId: 'a-xyz-456',
          },
        },
      },
    };

    const { result } = renderHook(() => useAuth());
    expect(result.current).toEqual({
      userName: 'alice@contoso.com',
      firstName: 'Alice',
      lastName: 'Smith',
      contactId: 'c-abc-123',
      accountId: 'a-xyz-456',
    });
  });

  it('returns null when window["Microsoft"] is undefined', () => {
    delete (window as MicrosoftPortalWindow).Microsoft;

    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeNull();
  });

  it('returns null when userName is empty string (unauthenticated portal session)', () => {
    (window as MicrosoftPortalWindow).Microsoft = {
      Dynamic365: {
        Portal: {
          User: {
            userName: '',
            firstName: '',
            lastName: '',
            contactId: '',
          },
        },
      },
    };

    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeNull();
  });

  it('returns null when Portal.User is undefined', () => {
    (window as MicrosoftPortalWindow).Microsoft = {
      Dynamic365: {
        Portal: {},
      },
    };

    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeNull();
  });

  it('returns mock user when VITE_MOCK_USER is true', () => {
    vi.stubEnv('VITE_MOCK_USER', 'true');

    const { result } = renderHook(() => useAuth());
    expect(result.current).toEqual({
      userName: 'dev@localhost',
      firstName: 'Dev',
      lastName: 'User',
      contactId: '00000000-0000-0000-0000-000000000001',
      accountId: undefined,
    });
  });
});
