import { useState, useEffect } from 'react';
import type { Case, TicketListFilters } from '@/types';
import { listIncidents } from '@/services/incidents';

const DEFAULT_FILTERS: TicketListFilters = {
  page: 1,
  pageSize: 25,
};

export function useTickets() {
  const [filters, setFilters] = useState<TicketListFilters>(DEFAULT_FILTERS);
  // effectiveSearchText is the debounced version of filters.searchText
  const [effectiveSearchText, setEffectiveSearchText] = useState<string | undefined>(
    DEFAULT_FILTERS.searchText
  );
  const [tickets, setTickets] = useState<Case[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input: only propagate filters.searchText to effectiveSearchText after 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setEffectiveSearchText(filters.searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.searchText]);

  // Fetch data when any non-search filter or the debounced search text changes
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    listIncidents({ ...filters, searchText: effectiveSearchText })
      .then((response) => {
        if (cancelled) return;
        setTickets(response.value);
        setTotalCount(response['@odata.count'] ?? 0);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setTickets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.status,
    filters.priority,
    filters.dateFrom,
    filters.dateTo,
    filters.page,
    filters.pageSize,
    effectiveSearchText,
  ]);

  const setPage = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return {
    tickets,
    totalCount,
    loading,
    error,
    filters,
    setFilters,
    setPage,
  };
}
