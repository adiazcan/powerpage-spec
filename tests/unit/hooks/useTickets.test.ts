import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/services/incidents', () => ({
  listIncidents: vi.fn(),
}));

import { useTickets } from '@/hooks/useTickets';
import * as incidentsModule from '@/services/incidents';
import { CaseState, CasePriority } from '@/types';

const mockTicket = {
  incidentid: 'abc',
  ticketnumber: 'CAS-001',
  title: 'Test ticket',
  statuscode: 1,
  prioritycode: 2,
  statecode: 0,
  createdon: '2026-02-01T00:00:00Z',
  modifiedon: '2026-02-10T00:00:00Z',
  description: '',
  casetypecode: 1,
  _customerid_value: 'c-abc-123',
};

const mockResponse = {
  '@odata.count': 1,
  value: [mockTicket],
};

describe('useTickets', () => {
  beforeEach(() => {
    vi.mocked(incidentsModule.listIncidents).mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial default state', () => {
    beforeEach(() => {
      vi.mocked(incidentsModule.listIncidents).mockImplementation(
        () => new Promise(() => {})
      );
    });

    it('starts with page 1 and pageSize 25', () => {
      const { result } = renderHook(() => useTickets());
      expect(result.current.filters.page).toBe(1);
      expect(result.current.filters.pageSize).toBe(25);
    });

    it('starts with no optional filters set', () => {
      const { result } = renderHook(() => useTickets());
      expect(result.current.filters.status).toBeUndefined();
      expect(result.current.filters.priority).toBeUndefined();
      expect(result.current.filters.searchText).toBeUndefined();
      expect(result.current.filters.dateFrom).toBeUndefined();
      expect(result.current.filters.dateTo).toBeUndefined();
    });

    it('starts with empty tickets array', () => {
      const { result } = renderHook(() => useTickets());
      expect(result.current.tickets).toEqual([]);
    });

    it('starts with totalCount 0', () => {
      const { result } = renderHook(() => useTickets());
      expect(result.current.totalCount).toBe(0);
    });

    it('starts with no error', () => {
      const { result } = renderHook(() => useTickets());
      expect(result.current.error).toBeNull();
    });
  });

  // ── Data fetching ─────────────────────────────────────────────────────────

  describe('data fetching', () => {
    it('calls listIncidents on mount', async () => {
      renderHook(() => useTickets());
      await waitFor(() => {
        expect(vi.mocked(incidentsModule.listIncidents)).toHaveBeenCalledTimes(1);
      });
    });

    it('populates tickets after successful fetch', async () => {
      const { result } = renderHook(() => useTickets());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tickets).toEqual(mockResponse.value);
    });

    it('sets totalCount from @odata.count', async () => {
      const { result } = renderHook(() => useTickets());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.totalCount).toBe(1);
    });

    it('sets loading=true during fetch then false on completion', async () => {
      const { result } = renderHook(() => useTickets());
      // loading starts true while fetch is in-flight
      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
    });
  });

  // ── Filter updates ────────────────────────────────────────────────────────

  describe('filter updates', () => {
    it('setFilters replaces the filters object', async () => {
      const { result } = renderHook(() => useTickets());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setFilters({ page: 1, pageSize: 25, status: CaseState.Active });
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.filters.status).toBe(CaseState.Active);
    });

    it('re-fetches when non-search filter changes', async () => {
      const { result } = renderHook(() => useTickets());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const callCountBefore = vi.mocked(incidentsModule.listIncidents).mock.calls.length;

      act(() => {
        result.current.setFilters({
          page: 1,
          pageSize: 25,
          priority: CasePriority.High,
        });
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(vi.mocked(incidentsModule.listIncidents).mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
    });

    it('exposes setFilters function', async () => {
      const { result } = renderHook(() => useTickets());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(typeof result.current.setFilters).toBe('function');
    });
  });

  // ── Page transitions ──────────────────────────────────────────────────────

  describe('page transitions', () => {
    it('setPage updates filters.page', async () => {
      const { result } = renderHook(() => useTickets());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setPage(3);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.filters.page).toBe(3);
    });

    it('setPage preserves other filters', async () => {
      const { result } = renderHook(() => useTickets());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setFilters({
          page: 1,
          pageSize: 25,
          priority: CasePriority.Normal,
        });
      });

      act(() => {
        result.current.setPage(2);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.filters.page).toBe(2);
      expect(result.current.filters.priority).toBe(CasePriority.Normal);
    });

    it('setPage triggers a re-fetch', async () => {
      const { result } = renderHook(() => useTickets());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const callCountBefore = vi.mocked(incidentsModule.listIncidents).mock.calls.length;

      act(() => {
        result.current.setPage(2);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(vi.mocked(incidentsModule.listIncidents).mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
    });
  });

  // ── Search text debounce ──────────────────────────────────────────────────

  describe('search text debounce', () => {
    it('does not call listIncidents immediately when searchText changes', async () => {
      vi.useFakeTimers();
      vi.mocked(incidentsModule.listIncidents).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTickets());

      // Let the initial mount settle — run all timers and flush microtasks
      await act(async () => {
        vi.runAllTimers();
        await Promise.resolve();
        await Promise.resolve();
      });

      vi.clearAllMocks();
      vi.mocked(incidentsModule.listIncidents).mockResolvedValue(mockResponse);

      // Update searchText — debounce timer starts but has NOT fired yet
      act(() => {
        result.current.setFilters({ page: 1, pageSize: 25, searchText: 'billing' });
      });

      // Should NOT have been called yet (debounce timer still pending)
      expect(vi.mocked(incidentsModule.listIncidents)).not.toHaveBeenCalled();
    });

    it('calls listIncidents after 300ms debounce when searchText changes', async () => {
      vi.useFakeTimers();
      vi.mocked(incidentsModule.listIncidents).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTickets());

      // Let the initial mount settle
      await act(async () => {
        vi.runAllTimers();
        await Promise.resolve();
        await Promise.resolve();
      });

      vi.clearAllMocks();
      vi.mocked(incidentsModule.listIncidents).mockResolvedValue(mockResponse);

      // Update searchText
      act(() => {
        result.current.setFilters({ page: 1, pageSize: 25, searchText: 'billing' });
      });

      // Advance exactly 300ms to trigger the debounce, then flush microtasks
      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(vi.mocked(incidentsModule.listIncidents)).toHaveBeenCalledWith(
        expect.objectContaining({ searchText: 'billing' })
      );
    });
  });

  // ── Reset / error behavior ────────────────────────────────────────────────

  describe('reset behavior', () => {
    it('clears error on successful re-fetch', async () => {
      vi.mocked(incidentsModule.listIncidents)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTickets());
      // Wait for the error to be set from the first (failing) call
      await waitFor(() => expect(result.current.error).toBe('Network error'));

      // Trigger a re-fetch by advancing to page 2 (page is currently 1)
      act(() => {
        result.current.setPage(2);
      });

      // Wait for the error to clear after the successful re-fetch
      await waitFor(() => expect(result.current.error).toBeNull());
      expect(result.current.tickets).toEqual(mockResponse.value);
    });

    it('returns empty tickets array and error message on API failure', async () => {
      vi.mocked(incidentsModule.listIncidents).mockRejectedValue(
        new Error('Server error')
      );

      const { result } = renderHook(() => useTickets());
      // Wait directly for the error to appear (not for loading)
      await waitFor(() => expect(result.current.error).toBe('Server error'));

      expect(result.current.tickets).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });
});
