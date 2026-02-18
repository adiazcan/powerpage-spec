import { useState, useEffect, useRef, useMemo } from 'react';
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

  // pageLinksRef.current[N] holds the @odata.nextLink needed to fetch page N.
  // Page 1 never needs a link (fetched from scratch). This cache is cleared whenever
  // the base query changes so stale links are not used with a new filter set.
  const pageLinksRef = useRef<Record<number, string>>({});

  // Composite key of all non-page, non-search filter values; used to detect cache invalidation.
  const filterKey = useMemo(
    () =>
      [
        filters.status ?? '',
        filters.priority ?? '',
        filters.dateFrom ?? '',
        filters.dateTo ?? '',
        filters.pageSize,
      ].join('|'),
    [filters.status, filters.priority, filters.dateFrom, filters.dateTo, filters.pageSize]
  );

  // Clear the nextLink cache when the base query parameters change.
  useEffect(() => {
    pageLinksRef.current = {};
  }, [filterKey]);

  useEffect(() => {
    pageLinksRef.current = {};
  }, [effectiveSearchText]);

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

    // Use the cached nextLink for pages beyond the first; fall back to a fresh query.
    const nextLink = filters.page > 1 ? pageLinksRef.current[filters.page] : undefined;

    listIncidents({ ...filters, searchText: effectiveSearchText }, nextLink)
      .then((response) => {
        if (cancelled) return;
        setTickets(response.value);
        setTotalCount(response['@odata.count'] ?? 0);
        // Cache the server's nextLink so the following page can be fetched without $skip.
        if (response['@odata.nextLink']) {
          pageLinksRef.current[filters.page + 1] = response['@odata.nextLink'];
        }
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
