import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { AuthGuard } from '@/components/AuthGuard';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useAntiForgeryToken');
import * as useAuthModule from '@/hooks/useAuth';
import * as useAntiForgeryTokenModule from '@/hooks/useAntiForgeryToken';

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
    vi.mocked(useAntiForgeryTokenModule.useAntiForgeryToken).mockReturnValue(null);

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

  it('shows sign-in prompt when user is null', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(null);
    vi.mocked(useAntiForgeryTokenModule.useAntiForgeryToken).mockReturnValue('mock-csrf-token');

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

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
  });

  it('renders POST form with CSRF token and returnUrl', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(null);
    vi.mocked(useAntiForgeryTokenModule.useAntiForgeryToken).mockReturnValue('mock-csrf-token');

    const { container } = render(
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

    const form = container.querySelector('form');
    expect(form).toHaveAttribute('action', '/Account/Login/ExternalLogin?returnUrl=%2Fprotected');
    expect(form).toHaveAttribute('method', 'post');

    const csrfInput = container.querySelector('input[name="__RequestVerificationToken"]');
    expect(csrfInput).toHaveAttribute('value', 'mock-csrf-token');
  });
});
