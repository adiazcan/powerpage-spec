import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { AuthButton } from '@/components/AuthButton';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useAntiForgeryToken');
import * as useAuthModule from '@/hooks/useAuth';
import * as useAntiForgeryTokenModule from '@/hooks/useAntiForgeryToken';

describe('AuthButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Sign In form with CSRF token when user is null', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(null);
    vi.mocked(useAntiForgeryTokenModule.useAntiForgeryToken).mockReturnValue('mock-csrf-token');

    const { container } = render(
      <MemoryRouter>
        <AuthButton />
      </MemoryRouter>
    );

    const form = container.querySelector('form');
    expect(form).toHaveAttribute('action', '/Account/Login/ExternalLogin');
    expect(form).toHaveAttribute('method', 'post');

    const csrfInput = container.querySelector('input[name="__RequestVerificationToken"]');
    expect(csrfInput).toHaveAttribute('value', 'mock-csrf-token');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    expect(submitButton).toHaveAttribute('name', 'provider');
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('renders Sign Out link with first name when user is authenticated', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      userName: 'alice@contoso.com',
      firstName: 'Alice',
      lastName: 'Smith',
      contactId: 'c-123',
    });
    vi.mocked(useAntiForgeryTokenModule.useAntiForgeryToken).mockReturnValue(null);

    render(
      <MemoryRouter>
        <AuthButton />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /sign out/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/Account/Login/LogOff?returnUrl=/');
    expect(link).toHaveTextContent('Alice');
  });
});
