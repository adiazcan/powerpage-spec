import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { Layout } from '@/components/Layout';

// Mock child components so this test focuses on Layout structure only
vi.mock('@/components/AuthButton', () => ({
  AuthButton: () => <button data-testid="auth-button">Auth</button>,
}));

describe('Layout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the AppBar with site title and AuthButton', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<span data-testid="outlet">Page content</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Support Portal')).toBeInTheDocument();
    expect(screen.getByTestId('auth-button')).toBeInTheDocument();
  });

  it('renders outlet content in the main area', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<span data-testid="page-content">Hello!</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('renders a footer', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={null} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Footer shows current year
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});
