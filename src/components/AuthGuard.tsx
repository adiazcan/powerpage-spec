import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
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

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Wraps protected routes. Unauthenticated users see a sign-in prompt.
 *
 * On a private Power Pages site the server forces login before the SPA loads,
 * so this guard only activates on public sites or during local development.
 *
 * Login is a POST form to /Account/Login/ExternalLogin per the official docs.
 * The user must click the button — auto-submit doesn't work because the
 * Vite dev proxy can't carry the Power Pages session cookie.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const user = useAuth();
  const token = useAntiForgeryToken();
  const location = useLocation();
  const tenantId = (window as PortalWindow).Microsoft?.Dynamic365?.Portal?.tenant ?? '';

  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);

    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <Stack spacing={3} alignItems="center">
          <Typography variant="h4">Sign In Required</Typography>
          <Typography variant="body1" color="text.secondary">
            Please sign in to access the Support Portal.
          </Typography>
          <Box>
            <form action={`/Account/Login/ExternalLogin?returnUrl=${returnUrl}`} method="post">
              <input name="__RequestVerificationToken" type="hidden" value={token ?? ''} />
              <Button
                name="provider"
                type="submit"
                variant="contained"
                size="large"
                value={`https://login.windows.net/${tenantId}/`}
              >
                Sign In with Microsoft
              </Button>
            </form>
          </Box>
        </Stack>
      </Container>
    );
  }

  return <>{children}</>;
}
