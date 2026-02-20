import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/services/api-client';
import { CreateTicket } from '@/pages/CreateTicket';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/useAntiForgeryToken', () => ({ useAntiForgeryToken: vi.fn() }));
vi.mock('@/services/incidents', () => ({ createIncident: vi.fn() }));
vi.mock('@/services/annotations', () => ({ createAnnotation: vi.fn() }));

import { useAuth } from '@/hooks/useAuth';
import { useAntiForgeryToken } from '@/hooks/useAntiForgeryToken';
import { createIncident } from '@/services/incidents';
import { createAnnotation } from '@/services/annotations';

function renderCreateTicket() {
  return render(
    <MemoryRouter initialEntries={['/tickets/new']}>
      <Routes>
        <Route path="/tickets/new" element={<CreateTicket />} />
        <Route path="/tickets/:id/confirm" element={<div>Confirmation</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CreateTicket', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      userName: 'alice@contoso.com',
      firstName: 'Alice',
      lastName: 'Smith',
      contactId: 'contact-123',
      accountId: 'account-456',
    });
    vi.mocked(useAntiForgeryToken).mockReturnValue('csrf-token');
    vi.mocked(createIncident).mockResolvedValue('inc-123');
    vi.mocked(createAnnotation).mockResolvedValue(undefined);

    sessionStorage.clear();
  });

  it('shows Yup validation errors for required fields', async () => {
    const user = userEvent.setup();
    renderCreateTicket();

    await user.click(screen.getByRole('button', { name: /submit ticket/i }));

    expect(await screen.findByText(/subject is required/i)).toBeInTheDocument();
    expect(screen.getByText(/category is required/i)).toBeInTheDocument();
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
  });

  it('shows file count error when 4 files are selected', async () => {
    const user = userEvent.setup();
    renderCreateTicket();

    const input = screen.getByLabelText(/attachments/i);
    const files = [
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['b'], 'b.pdf', { type: 'application/pdf' }),
      new File(['c'], 'c.pdf', { type: 'application/pdf' }),
      new File(['d'], 'd.pdf', { type: 'application/pdf' }),
    ];

    await user.upload(input, files);

    expect(await screen.findByText(/maximum of 3 files/i)).toBeInTheDocument();
  });

  it('shows file size error when file exceeds 10 MB', async () => {
    const user = userEvent.setup();
    renderCreateTicket();

    const elevenMb = new Uint8Array(11 * 1024 * 1024);
    const largeFile = new File([elevenMb], 'large.pdf', { type: 'application/pdf' });

    await user.upload(screen.getByLabelText(/attachments/i), largeFile);

    expect(await screen.findByText(/must be 10 MB or smaller/i)).toBeInTheDocument();
  });

  it('calls createIncident then createAnnotation in sequence on successful submit', async () => {
    const user = userEvent.setup();
    renderCreateTicket();

    await user.type(screen.getByLabelText(/subject/i), 'Cannot reset password');
    await user.selectOptions(screen.getByLabelText(/category/i), '1');
    await user.type(screen.getByLabelText(/description/i), 'Reset flow fails');

    const attachment = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText(/attachments/i), attachment);

    await user.click(screen.getByRole('button', { name: /submit ticket/i }));

    await waitFor(() => {
      expect(createIncident).toHaveBeenCalledTimes(1);
      expect(createAnnotation).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createIncident).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(createAnnotation).mock.invocationCallOrder[0]
      );
    });

    expect(createAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'notes.txt',
        mimetype: 'text/plain',
        'objectid_incident@odata.bind': '/incidents(inc-123)',
      }),
      'csrf-token'
    );
  });

  it('on 401 saves form in sessionStorage and redirects to login', async () => {
    const user = userEvent.setup();
    vi.mocked(createIncident).mockRejectedValue(new ApiError(401, 'Unauthorized'));

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderCreateTicket();

    await user.type(screen.getByLabelText(/subject/i), 'Cannot reset password');
    await user.selectOptions(screen.getByLabelText(/category/i), '1');
    await user.type(screen.getByLabelText(/description/i), 'Reset flow fails');

    await user.click(screen.getByRole('button', { name: /submit ticket/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem('create-ticket-form')).toContain('Cannot reset password');
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('/Account/Login/ExternalLogin?returnUrl='),
        '_self'
      );
    });
  });

  it('shows error banner and preserves form data on server error', async () => {
    const user = userEvent.setup();
    vi.mocked(createIncident).mockRejectedValue(new ApiError(500, 'Server unavailable'));

    renderCreateTicket();

    const subject = screen.getByLabelText(/subject/i);
    const description = screen.getByLabelText(/description/i);

    await user.type(subject, 'Cannot reset password');
    await user.selectOptions(screen.getByLabelText(/category/i), '1');
    await user.type(description, 'Reset flow fails');
    await user.click(screen.getByRole('button', { name: /submit ticket/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/server unavailable/i);
    expect(subject).toHaveValue('Cannot reset password');
    expect(description).toHaveValue('Reset flow fails');
  });

  it('retries incident creation with explicit contact bind on 9004010D', async () => {
    const user = userEvent.setup();
    vi.mocked(createIncident)
      .mockReset()
      .mockRejectedValueOnce(new ApiError(400, 'Common Data Service error occurred.', '9004010D'))
      .mockResolvedValueOnce('inc-456');

    renderCreateTicket();

    await user.type(screen.getByLabelText(/subject/i), 'Cannot create ticket');
    await user.selectOptions(screen.getByLabelText(/category/i), '2');
    await user.type(screen.getByLabelText(/description/i), 'Dataverse returned a bad request');

    await user.click(screen.getByRole('button', { name: /submit ticket/i }));

    await waitFor(() => {
      expect(createIncident).toHaveBeenCalledTimes(2);
    });

    expect(vi.mocked(createIncident).mock.calls[0]?.[0]).toMatchObject({
      title: 'Cannot create ticket',
      casetypecode: 2,
    });

    expect(vi.mocked(createIncident).mock.calls[1]?.[0]).toMatchObject({
      title: 'Cannot create ticket',
      casetypecode: 2,
      'customerid_contact@odata.bind': '/contacts(contact-123)',
    });
  }, 15_000);
});
