import {
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  TextField,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useTickets } from '@/hooks/useTickets';
import { CasePriority, CaseState, CaseStatus } from '@/types';
import { formatCasePriorityLabel, formatCaseStatusLabel, formatDate } from '@/utils/formatters';
import './ticket-list.css';

const iconPortal = '/assets/ticket-list/icon-portal.svg';
const iconDashboard = '/assets/ticket-list/icon-dashboard.svg';
const iconTickets = '/assets/ticket-list/icon-tickets.svg';
const iconNew = '/assets/ticket-list/icon-new.svg';
const iconSearch = '/assets/ticket-list/icon-search.svg';
const iconBell = '/assets/ticket-list/icon-bell.svg';
const iconPlus = '/assets/ticket-list/icon-plus.svg';
const iconStatusActive = '/assets/ticket-list/icon-status-active.svg';
const iconStatusProgress = '/assets/ticket-list/icon-status-progress.svg';
const iconStatusWaiting = '/assets/ticket-list/icon-status-waiting.svg';
const iconStatusResolved = '/assets/ticket-list/icon-status-resolved.svg';
const iconStatusCancelled = '/assets/ticket-list/icon-status-cancelled.svg';
const iconPriorityHigh = '/assets/ticket-list/icon-priority-high.svg';
const iconPriorityNormal = '/assets/ticket-list/icon-priority-normal.svg';
const iconPriorityLow = '/assets/ticket-list/icon-priority-low.svg';

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function categoryLabel(casetypecode: number): string {
  if (casetypecode === 1) return 'Billing';
  if (casetypecode === 2) return 'Technical Support';
  if (casetypecode === 3) return 'General Inquiry';
  return 'Other';
}

function statusBadge(status: CaseStatus): { className: string; icon: string } {
  if (status === CaseStatus.InProgress || status === CaseStatus.Researching) {
    return { className: 'tl-chip tl-chip-progress', icon: iconStatusProgress };
  }
  if (status === CaseStatus.WaitingForDetails) {
    return { className: 'tl-chip tl-chip-waiting', icon: iconStatusWaiting };
  }
  if (status === CaseStatus.ProblemSolved) {
    return { className: 'tl-chip tl-chip-resolved', icon: iconStatusResolved };
  }
  if (status === CaseStatus.Cancelled) {
    return { className: 'tl-chip tl-chip-cancelled', icon: iconStatusCancelled };
  }
  return { className: 'tl-chip tl-chip-active', icon: iconStatusActive };
}

function priorityBadge(priority: CasePriority): { className: string; icon: string } {
  if (priority === CasePriority.High) {
    return { className: 'tl-chip tl-chip-critical', icon: iconPriorityHigh };
  }
  if (priority === CasePriority.Low) {
    return { className: 'tl-chip tl-chip-low', icon: iconPriorityLow };
  }
  return { className: 'tl-chip tl-chip-normal', icon: iconPriorityNormal };
}

export function TicketList() {
  const user = useAuth();
  const { tickets, totalCount, loading, error, filters, setFilters, setPage } = useTickets();

  const totalPages = Math.ceil(totalCount / filters.pageSize);
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Portal User';
  const accountLabel = user?.accountId ?? 'No account linked';
  const initials = initialsFromName(fullName);

  return (
    <div className="tl-shell" data-node-id="1:477">
      <aside className="tl-sidebar">
        <div className="tl-brand">
          <div className="tl-logo-wrap">
            <img src={iconPortal} alt="Portal" />
          </div>
          <div>
            <p className="tl-brand-title">Support Portal</p>
            <p className="tl-brand-subtitle">Dynamics 365</p>
          </div>
        </div>

        <div className="tl-divider" />

        <nav className="tl-nav" aria-label="Primary">
          <Link className="tl-nav-link" to="/">
            <img src={iconDashboard} alt="" />
            <span>Dashboard</span>
          </Link>
          <Link className="tl-nav-link tl-nav-link-active" to="/tickets" aria-current="page">
            <img src={iconTickets} alt="" />
            <span>My Tickets</span>
          </Link>
          <Link className="tl-nav-link" to="/tickets/new">
            <img src={iconNew} alt="" />
            <span>New Ticket</span>
          </Link>
        </nav>

        <div className="tl-divider" />

        <div className="tl-user">
          <div className="tl-avatar">{initials}</div>
          <div>
            <p className="tl-user-name">{fullName}</p>
            <p className="tl-user-org">{accountLabel}</p>
          </div>
        </div>
      </aside>

      <main className="tl-main">
        <header className="tl-header">
          <div className="tl-header-grow" />
          <button className="tl-icon-btn" type="button" aria-label="Search">
            <img src={iconSearch} alt="" />
          </button>
          <button className="tl-icon-btn tl-icon-btn-bell" type="button" aria-label="Notifications">
            <img src={iconBell} alt="" />
            <span className="tl-dot" />
          </button>
          <div className="tl-header-divider" />
          <div className="tl-header-user">
            <div className="tl-avatar tl-avatar-sm">{initials}</div>
            <span>{fullName}</span>
          </div>
        </header>

        <section className="tl-content">
          <div className="tl-title-row">
            <div className="tl-title-block">
              <img src={iconTickets} alt="" />
              <div>
                <h1>My Tickets</h1>
                <p>{`${tickets.length} of ${totalCount} cases`}</p>
              </div>
            </div>
            <Link className="tl-new-ticket" to="/tickets/new">
              <img src={iconPlus} alt="" />
              <span>New Ticket</span>
            </Link>
          </div>

          <div className="tl-filter-card" aria-label="Ticket filters">
            <TextField
              label="Search"
              size="small"
              value={filters.searchText ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, searchText: e.target.value || undefined, page: 1 })
              }
              inputProps={{ 'aria-label': 'Search tickets by subject' }}
              className="tl-search-input"
            />
            <div className="tl-filter-row">
              <FormControl size="small" className="tl-filter-field">
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

              <FormControl size="small" className="tl-filter-field">
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
                className="tl-filter-field"
              />

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
                className="tl-filter-field"
              />
            </div>
          </div>

          {error && <ErrorBanner message={error} />}
          {loading && <LoadingSpinner />}

          {!loading && !error && tickets.length === 0 && (
            <div className="tl-empty-wrap">
              <EmptyState headline="No tickets found" />
              <div className="tl-empty-link-wrap">
                <Link to="/tickets/new" aria-label="Create a new support ticket">
                  Create a new ticket
                </Link>
              </div>
            </div>
          )}

          {!loading && tickets.length > 0 && (
            <div className="tl-table-wrap">
              <table className="tl-table" aria-label="Support tickets">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Category</th>
                    <th>Created</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.incidentid}>
                      <td>
                        <Link
                          to={`/tickets/${ticket.incidentid}`}
                          aria-label={`View details for ticket ${ticket.ticketnumber}`}
                        >
                          {ticket.ticketnumber}
                        </Link>
                      </td>
                      <td>{ticket.title}</td>
                      <td>
                        {(() => {
                          const badge = statusBadge(ticket.statuscode);
                          return (
                            <span className={badge.className}>
                              <img src={badge.icon} alt="" />
                              <span>{formatCaseStatusLabel(ticket.statuscode)}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const badge = priorityBadge(ticket.prioritycode);
                          return (
                            <span className={badge.className}>
                              <img src={badge.icon} alt="" />
                              <span>{formatCasePriorityLabel(ticket.prioritycode)}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td>{categoryLabel(ticket.casetypecode)}</td>
                      <td>{formatDate(ticket.createdon)}</td>
                      <td>{formatDate(ticket.modifiedon)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="tl-pagination-wrap">
              <Pagination
                aria-label="Pagination navigation"
                count={totalPages}
                page={filters.page}
                onChange={(_, page) => setPage(page)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </div>
          )}

          {!loading && totalCount > 0 && (
            <p className="tl-total-count">{totalCount} ticket{totalCount !== 1 ? 's' : ''} total</p>
          )}
        </section>
      </main>
    </div>
  );
}
