import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { CasePriority, CaseState } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useTickets } from '@/hooks/useTickets';
import { formatDate, formatCasePriorityLabel, formatCaseStatusLabel } from '@/utils/formatters';

export function TicketList() {
  const { tickets, totalCount, loading, error, filters, setFilters, setPage } = useTickets();

  const totalPages = Math.ceil(totalCount / filters.pageSize);

  return (
    <Box>
      <Box
        display="flex"
        flexWrap="wrap"
        gap={2}
        alignItems="center"
        mb={3}
        component="section"
        aria-label="Ticket filters"
      >
        {/* Free-text search */}
        <TextField
          label="Search"
          size="small"
          value={filters.searchText ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, searchText: e.target.value || undefined, page: 1 })
          }
          inputProps={{ 'aria-label': 'Search tickets by subject' }}
          sx={{ minWidth: 220 }}
        />

        {/* Status filter */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            label="Status"
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                status: e.target.value === '' ? undefined : (Number(e.target.value) as CaseState),
                page: 1,
              })
            }
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value={CaseState.Active}>Active</MenuItem>
            <MenuItem value={CaseState.Resolved}>Resolved</MenuItem>
            <MenuItem value={CaseState.Cancelled}>Cancelled</MenuItem>
          </Select>
        </FormControl>

        {/* Priority filter */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="priority-filter-label">Priority</InputLabel>
          <Select
            labelId="priority-filter-label"
            label="Priority"
            value={filters.priority ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                priority:
                  e.target.value === '' ? undefined : (Number(e.target.value) as CasePriority),
                page: 1,
              })
            }
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value={CasePriority.High}>High</MenuItem>
            <MenuItem value={CasePriority.Normal}>Normal</MenuItem>
            <MenuItem value={CasePriority.Low}>Low</MenuItem>
          </Select>
        </FormControl>

        {/* Date from */}
        <TextField
          label="From"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={filters.dateFrom ? filters.dateFrom.slice(0, 10) : ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              dateFrom: e.target.value ? `${e.target.value}T00:00:00Z` : undefined,
              page: 1,
            })
          }
          sx={{ minWidth: 160 }}
        />

        {/* Date to */}
        <TextField
          label="To"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={filters.dateTo ? filters.dateTo.slice(0, 10) : ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              dateTo: e.target.value ? `${e.target.value}T23:59:59Z` : undefined,
              page: 1,
            })
          }
          sx={{ minWidth: 160 }}
        />
      </Box>

      {/* Error banner */}
      {error && (
        <Box mb={2}>
          <ErrorBanner message={error} />
        </Box>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner />}

      {/* Empty state */}
      {!loading && !error && tickets.length === 0 && (
        <Box>
          <EmptyState headline="No tickets found" />
          <Box display="flex" justifyContent="center" mt={1}>
            <Link to="/tickets/new" aria-label="Create a new support ticket">
              Create a new ticket
            </Link>
          </Box>
        </Box>
      )}

      {/* Table */}
      {!loading && tickets.length > 0 && (
        <Table aria-label="Support tickets">
          <TableHead>
            <TableRow>
              <TableCell>Ticket #</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.incidentid} hover>
                <TableCell>
                  <Link
                    to={`/tickets/${ticket.incidentid}`}
                    aria-label={`View details for ticket ${ticket.ticketnumber}`}
                  >
                    {ticket.ticketnumber}
                  </Link>
                </TableCell>
                <TableCell>{ticket.title}</TableCell>
                <TableCell>{formatCaseStatusLabel(ticket.statuscode)}</TableCell>
                <TableCell>{formatCasePriorityLabel(ticket.prioritycode)}</TableCell>
                <TableCell>{formatDate(ticket.createdon)}</TableCell>
                <TableCell>{formatDate(ticket.modifiedon)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            aria-label="Pagination navigation"
            count={totalPages}
            page={filters.page}
            onChange={(_, page) => setPage(page)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Total count */}
      {!loading && totalCount > 0 && (
        <Typography variant="body2" color="text.secondary" mt={1} textAlign="right">
          {totalCount} ticket{totalCount !== 1 ? 's' : ''} total
        </Typography>
      )}
    </Box>
  );
}
