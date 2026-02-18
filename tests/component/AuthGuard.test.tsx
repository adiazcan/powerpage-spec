import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { AuthGuard } from '@/components/AuthGuard';

vi.mock('@/hooks/useAuth');
import * as useAuthModule from '@/hooks/useAuth';

describe('AuthGuard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when user is authenticated', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      userName: 'user@contoso.com',
      firstName: 'Alice',
      lastName: 'Smith',
      contactId: 'c-abc-123',
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <AuthGuard>
                <span data-testid="protected-content">Protected Content</span>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('redirects to /Account/Login/ExternalLogin when user is null', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <AuthGuard>
                <span data-testid="protected-content">Protected Content</span>
              </AuthGuard>
            }
          />
          <Route
            path="/Account/Login/ExternalLogin"
            element={<span data-testid="login-page">Login Page</span>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});
