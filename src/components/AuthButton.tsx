import { Button } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useAntiForgeryToken } from '@/hooks/useAntiForgeryToken';

type PortalWindow = Window & {
  Microsoft?: {
    Dynamic365?: {
      Portal?: {
        tenant?: string;
      };
    };
  };
};

/**
 * Renders a Sign In or Sign Out button using Power Pages auth paths.
 * Login:  POST /Account/Login/ExternalLogin (requires CSRF token + provider)
 * Logout: /Account/Login/LogOff?returnUrl=/
 */
export function AuthButton() {
  const user = useAuth();
  const token = useAntiForgeryToken();
  const tenantId = (window as PortalWindow).Microsoft?.Dynamic365?.Portal?.tenant ?? '';

  if (!user) {
    return (
      <form action="/Account/Login/ExternalLogin" method="post">
        <input name="__RequestVerificationToken" type="hidden" value={token ?? ''} />
        <Button
          name="provider"
          type="submit"
          color="inherit"
          value={`https://login.windows.net/${tenantId}/`}
        >
          Sign In
        </Button>
      </form>
    );
  }

  return (
    <Button color="inherit" component="a" href="/Account/Login/LogOff?returnUrl=/">
      Sign Out ({user.firstName})
    </Button>
  );
}
