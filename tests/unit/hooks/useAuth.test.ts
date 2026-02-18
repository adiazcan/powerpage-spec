import { describe, it, expect, afterEach } from 'vitest';
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
});
