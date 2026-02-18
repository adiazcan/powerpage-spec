import { Button } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';

/**
 * Renders a Sign In or Sign Out button using Power Pages auth paths.
 * Login:  /Account/Login/ExternalLogin
 * Logout: /Account/Login/LogOff?returnUrl=/
 */
export function AuthButton() {
  const user = useAuth();

  if (!user) {
    return (
      <Button color="inherit" component="a" href="/Account/Login/ExternalLogin">
        Sign In
      </Button>
    );
  }

  return (
    <Button color="inherit" component="a" href="/Account/Login/LogOff?returnUrl=/">
      Sign Out ({user.firstName})
    </Button>
  );
}
