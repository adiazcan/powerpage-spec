import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTickets } from '@/hooks/useTickets';
import { CasePriority, CaseState, CaseStatus } from '@/types';
import { formatCasePriorityLabel, formatCaseStatusLabel, formatDate } from '@/utils/formatters';
import './home.css';

const iconHome = '/assets/home/icon-home.svg';
const iconDashboard = '/assets/home/icon-dashboard.svg';
const iconTickets = '/assets/home/icon-tickets.svg';
const iconNew = '/assets/home/icon-new.svg';
const iconSearch = '/assets/home/icon-search.svg';
const iconBell = '/assets/home/icon-bell.svg';
const iconPlus = '/assets/home/icon-plus.svg';
const iconCard1 = '/assets/home/icon-card-1.svg';
const iconCard2 = '/assets/home/icon-card-2.svg';
const iconCard3 = '/assets/home/icon-card-3.svg';
const iconCard4 = '/assets/home/icon-card-4.svg';
const iconRecent = '/assets/home/icon-recent.svg';
const iconArrow = '/assets/home/icon-arrow.svg';
const iconCritical = '/assets/home/icon-critical.svg';
const iconActive = '/assets/home/icon-active.svg';
const iconHigh = '/assets/home/icon-high.svg';
const iconProgress = '/assets/home/icon-progress.svg';
const iconNormal = '/assets/home/icon-normal.svg';
const iconWaiting = '/assets/home/icon-waiting.svg';

type StatCard = {
  label: string;
  value: string;
  icon: string;
  iconClass: string;
};

type ActivityChip = {
  label: string;
  className: string;
  icon: string;
};

type ActivityItem = {
  id: string;
  subject: string;
  updated: string;
  chips: ActivityChip[];
};

function statusChip(status: CaseStatus): ActivityChip {
  if (status === CaseStatus.WaitingForDetails) {
    return { label: formatCaseStatusLabel(status), className: 'hp-chip hp-chip-waiting', icon: iconWaiting };
  }
  if (status === CaseStatus.InProgress || status === CaseStatus.Researching) {
    return { label: formatCaseStatusLabel(status), className: 'hp-chip hp-chip-progress', icon: iconProgress };
  }
  return { label: formatCaseStatusLabel(status), className: 'hp-chip hp-chip-active', icon: iconActive };
}

function priorityChip(priority: CasePriority): ActivityChip {
  if (priority === CasePriority.High) {
    return { label: formatCasePriorityLabel(priority), className: 'hp-chip hp-chip-critical', icon: iconCritical };
  }
  if (priority === CasePriority.Normal) {
    return { label: formatCasePriorityLabel(priority), className: 'hp-chip hp-chip-normal', icon: iconNormal };
  }
  return { label: formatCasePriorityLabel(priority), className: 'hp-chip hp-chip-high', icon: iconHigh };
}

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Home() {
  const user = useAuth();
  const { tickets, loading, error } = useTickets();

  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Portal User';
  const initials = initialsFromName(fullName);
  const firstName = user?.firstName ?? 'there';
  const accountLabel = user?.accountId ?? 'No account linked';

  const statCards: StatCard[] = [
    {
      label: 'Active Cases',
      value: String(tickets.filter((ticket) => ticket.statecode === CaseState.Active).length),
      icon: iconCard1,
      iconClass: 'hp-stat-icon hp-stat-icon-blue',
    },
    {
      label: 'Awaiting Response',
      value: String(
        tickets.filter((ticket) => ticket.statuscode === CaseStatus.WaitingForDetails).length
      ),
      icon: iconCard2,
      iconClass: 'hp-stat-icon hp-stat-icon-lilac',
    },
    {
      label: 'Resolved',
      value: String(tickets.filter((ticket) => ticket.statecode === CaseState.Resolved).length),
      icon: iconCard3,
      iconClass: 'hp-stat-icon hp-stat-icon-green',
    },
    {
      label: 'Critical',
      value: String(tickets.filter((ticket) => ticket.prioritycode === CasePriority.High).length),
      icon: iconCard4,
      iconClass: 'hp-stat-icon hp-stat-icon-red',
    },
  ];

  const activityItems: ActivityItem[] = tickets.slice(0, 5).map((ticket) => ({
    id: ticket.ticketnumber,
    subject: ticket.title,
    updated: `Updated ${formatDate(ticket.modifiedon)}`,
    chips: [priorityChip(ticket.prioritycode), statusChip(ticket.statuscode)],
  }));

  return (
    <div className="hp-root" data-node-id="1:245">
      <aside className="hp-sidebar" data-node-id="1:246">
        <div className="hp-sidebar-brand" data-node-id="1:247">
          <div className="hp-brand-icon-wrap" data-node-id="1:248">
            <img className="hp-brand-icon" src={iconHome} alt="Portal" />
          </div>
          <div className="hp-brand-text">
            <p className="hp-brand-title">Support Portal</p>
            <p className="hp-brand-subtitle">Dynamics 365</p>
          </div>
        </div>

        <div className="hp-separator" />

        <nav className="hp-nav" aria-label="Main navigation">
          <a className="hp-nav-link hp-nav-link-active" href="/" aria-current="page">
            <img src={iconDashboard} alt="" />
            <span>Dashboard</span>
          </a>
          <Link className="hp-nav-link" to="/tickets">
            <img src={iconTickets} alt="" />
            <span>My Tickets</span>
          </Link>
          <Link className="hp-nav-link" to="/tickets/new">
            <img src={iconNew} alt="" />
            <span>New Ticket</span>
          </Link>
        </nav>

        <div className="hp-separator hp-separator-bottom" />

        <div className="hp-user-card">
          <div className="hp-avatar">{initials}</div>
          <div>
            <p className="hp-user-name">{fullName}</p>
            <p className="hp-user-org">{accountLabel}</p>
          </div>
        </div>
      </aside>

      <main className="hp-main">
        <header className="hp-topbar">
          <div className="hp-topbar-grow" />
          <button className="hp-icon-btn" type="button" aria-label="Search">
            <img src={iconSearch} alt="" />
          </button>
          <button className="hp-icon-btn hp-icon-btn-bell" type="button" aria-label="Notifications">
            <img src={iconBell} alt="" />
            <span className="hp-bell-dot" />
          </button>
          <div className="hp-topbar-separator" />
          <div className="hp-topbar-user">
            <div className="hp-avatar hp-avatar-sm">{initials}</div>
            <span>{fullName}</span>
          </div>
        </header>

        <section className="hp-content">
          <div className="hp-hero-row">
            <div>
              <h1>{`Welcome back, ${firstName}`}</h1>
              <p>{`Here's an overview of your support cases for ${accountLabel}`}</p>
            </div>
            <Link className="hp-primary-btn" to="/tickets/new">
              <img src={iconPlus} alt="" />
              <span>New Ticket</span>
            </Link>
          </div>

          <div className="hp-stats-grid">
            {statCards.map((card) => (
              <article key={card.label} className="hp-stat-card">
                <div className="hp-stat-head">
                  <span>{card.label}</span>
                  <div className={card.iconClass}>
                    <img src={card.icon} alt="" />
                  </div>
                </div>
                <p className="hp-stat-value">{card.value}</p>
              </article>
            ))}
          </div>

          <section className="hp-activity-card">
            <div className="hp-activity-head">
              <div className="hp-activity-title">
                <img src={iconRecent} alt="" />
                <span>Recent Activity</span>
              </div>
              <button className="hp-view-all" type="button">
                <span>View All</span>
                <img src={iconArrow} alt="" />
              </button>
            </div>

            <div className="hp-activity-list">
              {!loading && !error && activityItems.length === 0 && (
                <article className="hp-activity-item">
                  <div className="hp-activity-copy">
                    <p className="hp-case-subject">No recent activity yet.</p>
                  </div>
                </article>
              )}
              {activityItems.map((item) => (
                <article key={item.id} className="hp-activity-item">
                  <div className="hp-activity-copy">
                    <p className="hp-case-id">{item.id}</p>
                    <p className="hp-case-subject">{item.subject}</p>
                    <p className="hp-case-updated">{item.updated}</p>
                  </div>
                  <div className="hp-chip-row">
                    {item.chips.map((chip) => (
                      <span key={`${item.id}-${chip.label}`} className={chip.className}>
                        <img src={chip.icon} alt="" />
                        <span>{chip.label}</span>
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
