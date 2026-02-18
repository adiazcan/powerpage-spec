import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Wraps protected routes. Unauthenticated users are redirected to the
 * Power Pages login page with the current path as the return URL.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const user = useAuth();
  const location = useLocation();

  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return (
      <Navigate to={`/Account/Login/ExternalLogin?returnUrl=${returnUrl}`} replace />
    );
  }

  return <>{children}</>;
}
