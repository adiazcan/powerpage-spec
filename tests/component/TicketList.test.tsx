import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CaseStatus, CasePriority, CaseState } from '@/types';

vi.mock('@/hooks/useTickets');
import * as useTicketsModule from '@/hooks/useTickets';

import { TicketList } from '@/pages/TicketList';

const mockSetFilters = vi.fn();
const mockSetPage = vi.fn();

const defaultHookReturn = {
  tickets: [],
  totalCount: 0,
  loading: false,
  error: null,
  filters: { page: 1, pageSize: 25 },
  setFilters: mockSetFilters,
  setPage: mockSetPage,
};

const mockTickets = [
  {
    incidentid: 'abc-123',
    ticketnumber: 'CAS-00001-ABC123',
    title: 'Cannot reset password',
    statuscode: CaseStatus.InProgress,
    prioritycode: CasePriority.High,
    statecode: CaseState.Active,
    createdon: '2026-02-01T10:00:00Z',
    modifiedon: '2026-02-15T14:30:00Z',
    description: 'Password reset is not working',
    casetypecode: 1,
    _customerid_value: 'c-abc-123',
  },
  {
    incidentid: 'def-456',
    ticketnumber: 'CAS-00002-DEF456',
    title: 'Billing discrepancy on invoice',
    statuscode: CaseStatus.OnHold,
    prioritycode: CasePriority.Normal,
    statecode: CaseState.Active,
    createdon: '2026-02-05T08:00:00Z',
    modifiedon: '2026-02-10T09:00:00Z',
    description: 'Incorrect charge on invoice',
    casetypecode: 2,
    _customerid_value: 'c-abc-123',
  },
];

function renderTicketList() {
  return render(
    <MemoryRouter>
      <TicketList />
    </MemoryRouter>
  );
}

describe('TicketList', () => {
  beforeEach(() => {
    vi.mocked(useTicketsModule.useTickets).mockReturnValue({ ...defaultHookReturn });
    mockSetFilters.mockClear();
    mockSetPage.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Ticket rows ───────────────────────────────────────────────────────────

  describe('ticket rows', () => {
    it('renders a row for each ticket', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        tickets: mockTickets,
        totalCount: 2,
      });

      renderTicketList();

      expect(screen.getByText('CAS-00001-ABC123')).toBeInTheDocument();
      expect(screen.getByText('CAS-00002-DEF456')).toBeInTheDocument();
    });

    it('renders ticket titles', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        tickets: mockTickets,
        totalCount: 2,
      });

      renderTicketList();

      expect(screen.getByText('Cannot reset password')).toBeInTheDocument();
      expect(screen.getByText('Billing discrepancy on invoice')).toBeInTheDocument();
    });

    it('renders formatted status labels', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        tickets: [mockTickets[0]],
        totalCount: 1,
      });

      renderTicketList();

      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('renders formatted priority labels', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        tickets: [mockTickets[0]],
        totalCount: 1,
      });

      renderTicketList();

      expect(screen.getByText('High')).toBeInTheDocument();
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner when loading=true', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        loading: true,
      });

      renderTicketList();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('hides loading spinner when loading=false', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        loading: false,
      });

      renderTicketList();

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows empty state when tickets array is empty and not loading', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        tickets: [],
        loading: false,
      });

      renderTicketList();

      expect(screen.getByText(/no tickets/i)).toBeInTheDocument();
    });

    it('does not show empty state when tickets exist', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        tickets: mockTickets,
        totalCount: 2,
      });

      renderTicketList();

      expect(screen.queryByText(/no tickets/i)).not.toBeInTheDocument();
    });

    it('shows a link to create a new ticket in empty state', () => {
      renderTicketList();

      const link = screen.getByRole('link', { name: /create a new support ticket/i });
      expect(link).toBeInTheDocument();
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows error banner when error is set', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        error: 'Failed to load tickets',
      });

      renderTicketList();

      expect(screen.getByText('Failed to load tickets')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('does not show error banner when error is null', () => {
      renderTicketList();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ── Filter controls ───────────────────────────────────────────────────────

  describe('filter controls', () => {
    it('renders a search input', () => {
      renderTicketList();

      expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument();
    });

    it('calls setFilters with updated searchText on search input change', () => {
      renderTicketList();

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      fireEvent.change(searchInput, { target: { value: 'billing' } });

      expect(mockSetFilters).toHaveBeenCalledWith(
        expect.objectContaining({ searchText: 'billing', page: 1 })
      );
    });

    it('renders a status filter select', () => {
      renderTicketList();

      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    });

    it('renders a priority filter select', () => {
      renderTicketList();

      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  describe('pagination', () => {
    it('renders pagination controls when there are multiple pages', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        tickets: mockTickets,
        totalCount: 100,
        filters: { page: 1, pageSize: 25 },
      });

      renderTicketList();

      const pagination = screen.getByRole('navigation', { name: /pagination/i });
      expect(pagination).toBeInTheDocument();
    });

    it('calls setPage when a pagination page button is clicked', () => {
      vi.mocked(useTicketsModule.useTickets).mockReturnValue({
        ...defaultHookReturn,
        tickets: mockTickets,
        totalCount: 100,
        filters: { page: 1, pageSize: 25 },
      });

      renderTicketList();

      const page2Button = screen.getByRole('button', { name: /go to page 2/i });
      fireEvent.click(page2Button);

      expect(mockSetPage).toHaveBeenCalledWith(2);
    });
  });
});
