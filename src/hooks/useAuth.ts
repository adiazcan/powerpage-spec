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
 * Returns null when unauthenticated (userName is empty or the object is absent).
 */
export function useAuth(): PortalUser | null {
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
