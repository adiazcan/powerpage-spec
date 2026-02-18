import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { AuthButton } from '@/components/AuthButton';

vi.mock('@/hooks/useAuth');
import * as useAuthModule from '@/hooks/useAuth';

describe('AuthButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Sign In link when user is null', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue(null);

    render(
      <MemoryRouter>
        <AuthButton />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/Account/Login/ExternalLogin');
  });

  it('renders Sign Out link with first name when user is authenticated', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      userName: 'alice@contoso.com',
      firstName: 'Alice',
      lastName: 'Smith',
      contactId: 'c-123',
    });

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
