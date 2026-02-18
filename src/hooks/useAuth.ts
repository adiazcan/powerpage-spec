import { PortalUser } from '@/types';

type PortalWindow = Window & {
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

/**
 * Reads the authenticated user from the Power Pages portal context
 * injected by the platform at `window["Microsoft"].Dynamic365.Portal.User`.
 *
 * In local development (when `VITE_MOCK_USER` is set to "true"), returns a
 * mock user so the app can be developed without a live Power Pages session.
 *
 * Returns null when unauthenticated (userName is empty or the object is absent).
 */
export function useAuth(): PortalUser | null {
  // Development mock — set VITE_MOCK_USER=true in .env.local to bypass auth
  if (import.meta.env.VITE_MOCK_USER === 'true') {
    return {
      userName: import.meta.env.VITE_MOCK_USER_EMAIL ?? 'dev@localhost',
      firstName: import.meta.env.VITE_MOCK_USER_FIRST ?? 'Dev',
      lastName: import.meta.env.VITE_MOCK_USER_LAST ?? 'User',
      contactId: import.meta.env.VITE_MOCK_USER_CONTACT_ID ?? '00000000-0000-0000-0000-000000000001',
      accountId: import.meta.env.VITE_MOCK_USER_ACCOUNT_ID,
    };
  }

  try {
    const portalUser = (window as PortalWindow).Microsoft?.Dynamic365?.Portal?.User;

    if (!portalUser?.userName) {
      return null;
    }

    return {
      userName: portalUser.userName,
      firstName: portalUser.firstName,
      lastName: portalUser.lastName,
      contactId: portalUser.contactId,
      accountId: portalUser.accountId,
    };
  } catch {
    return null;
  }
}
