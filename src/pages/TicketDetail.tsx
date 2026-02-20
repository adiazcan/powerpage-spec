import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api-client';
import { listActivities } from '@/services/activities';
import { getAnnotation, listAnnotations } from '@/services/annotations';
import { getIncident } from '@/services/incidents';
import type { Activity, Annotation, Case } from '@/types';
import { formatCasePriorityLabel, formatCaseStatusLabel, formatDate } from '@/utils/formatters';
import './ticket-detail.css';

const iconPortal = '/assets/ticket-detail/icon-portal.svg';
const iconDashboard = '/assets/ticket-detail/icon-dashboard.svg';
const iconTickets = '/assets/ticket-detail/icon-tickets.svg';
const iconNew = '/assets/ticket-detail/icon-new.svg';
const iconSearch = '/assets/ticket-detail/icon-search.svg';
const iconBell = '/assets/ticket-detail/icon-bell.svg';
const iconBack = '/assets/ticket-detail/icon-back.svg';
const iconDescription = '/assets/ticket-detail/icon-description.svg';
const iconTimeline = '/assets/ticket-detail/icon-timeline.svg';
const iconActive = '/assets/ticket-detail/icon-active.svg';
const iconPriority = '/assets/ticket-detail/icon-priority.svg';
const iconClock = '/assets/ticket-detail/icon-clock.svg';

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth();

  const [ticket, setTicket] = useState<Case | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attachments, setAttachments] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Ticket not found.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getIncident(id), listActivities(id), listAnnotations(id)])
      .then(([incident, timeline, notes]) => {
        if (cancelled) return;
        setTicket(incident);
        setActivities([...timeline].sort((a, b) => a.createdon.localeCompare(b.createdon)));
        setAttachments(notes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        if (err instanceof ApiError) {
          if (err.status === 403) {
            setError('You are not authorized to view this ticket.');
            return;
          }
          if (err.status === 404) {
            setError('Ticket not found.');
            return;
          }
        }

        const message = err instanceof Error ? err.message : 'Failed to load ticket details.';
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDownload = async (annotationId: string) => {
    try {
      const annotation = await getAnnotation(annotationId);
      if (!annotation.documentbody || !annotation.filename || !annotation.mimetype) {
        throw new Error('Attachment is missing file data.');
      }

      const blob = base64ToBlob(annotation.documentbody, annotation.mimetype);
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = annotation.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download attachment.';
      setError(message);
    }
  };

  const assignedOwner =
    ticket?.['_ownerid_value@OData.Community.Display.V1.FormattedValue'] ?? ticket?._ownerid_value;
  const agentName = assignedOwner ?? 'Unassigned';
  const shellName = user ? `${user.firstName} ${user.lastName}` : 'Sarah Chen';
  const shellAccount = user?.accountId ?? 'Contoso Ltd';
  const shellInitials = initialsFromName(shellName);

  return (
    <div className="td-shell" data-node-id="1:1217">
      <aside className="td-sidebar">
        <div className="td-sidebar-brand">
          <div className="td-logo-wrap">
            <img src={iconPortal} alt="Portal" />
          </div>
          <div>
            <p className="td-brand-title">Support Portal</p>
            <p className="td-brand-subtitle">Dynamics 365</p>
          </div>
        </div>

        <div className="td-divider" />

        <nav className="td-nav" aria-label="Primary">
          <Link className="td-nav-link" to="/">
            <img src={iconDashboard} alt="" />
            <span>Dashboard</span>
          </Link>
          <Link className="td-nav-link td-nav-link-active" to="/tickets" aria-current="page">
            <img src={iconTickets} alt="" />
            <span>My Tickets</span>
          </Link>
          <Link className="td-nav-link" to="/tickets/new">
            <img src={iconNew} alt="" />
            <span>New Ticket</span>
          </Link>
        </nav>

        <div className="td-divider" />

        <div className="td-sidebar-user">
          <div className="td-avatar">{shellInitials}</div>
          <div>
            <p className="td-user-name">{shellName}</p>
            <p className="td-user-org">{shellAccount}</p>
          </div>
        </div>
      </aside>

      <main className="td-main">
        <header className="td-header">
          <div className="td-header-grow" />
          <button className="td-icon-btn" type="button" aria-label="Search">
            <img src={iconSearch} alt="" />
          </button>
          <button className="td-icon-btn td-icon-btn-bell" type="button" aria-label="Notifications">
            <img src={iconBell} alt="" />
            <span className="td-dot" />
          </button>
          <div className="td-header-divider" />
          <div className="td-header-user">
            <div className="td-avatar td-avatar-sm">{shellInitials}</div>
            <span>{shellName}</span>
          </div>
        </header>

        <section className="td-page">
          <button className="td-back" type="button" onClick={() => navigate(-1)} aria-label="Back to tickets">
            <img src={iconBack} alt="" />
            <span>Back to My Tickets</span>
          </button>

          {error && <ErrorBanner message={error} />}
          {loading && <LoadingSpinner />}

          {!loading && !error && ticket && (
            <>
              <div className="td-heading">
                <div className="td-heading-meta">
                  <span className="td-ticket-number">{ticket.ticketnumber}</span>
                  <span className="td-chip td-chip-active">
                    <img src={iconActive} alt="" />
                    <span>{formatCaseStatusLabel(ticket.statuscode)}</span>
                  </span>
                  <span className="td-chip td-chip-priority">
                    <img src={iconPriority} alt="" />
                    <span>{formatCasePriorityLabel(ticket.prioritycode)}</span>
                  </span>
                </div>
                <h1>{ticket.title}</h1>
                <p className="td-updated">
                  <img src={iconClock} alt="" />
                  <span>Updated {formatDate(ticket.modifiedon)}</span>
                </p>
              </div>

              <div className="td-grid">
                <div className="td-left-column">
                  <section className="td-card" aria-labelledby="ticket-description-heading">
                    <h2 id="ticket-description-heading" className="td-card-title">
                      <img src={iconDescription} alt="" />
                      <span>Description</span>
                    </h2>
                    <p className="td-muted">{ticket.description || 'No description provided.'}</p>
                  </section>

                  <section className="td-card" aria-labelledby="activity-timeline-heading">
                    <h2 id="activity-timeline-heading" className="td-card-title">
                      <img src={iconTimeline} alt="" />
                      <span>Activity Timeline</span>
                    </h2>
                    <div className="td-timeline">
                      {activities.length === 0 ? (
                        <p className="td-muted">No timeline entries.</p>
                      ) : (
                        activities.map((activity, index) => (
                          <article key={activity.activityid} className="td-event">
                            <div className="td-event-dot" />
                            <div>
                              <div className="td-event-head">
                                <strong data-testid="timeline-subject">
                                  {activity.subject || activity.activitytypecode}
                                </strong>
                                <span>{formatDate(activity.createdon)}</span>
                              </div>
                              {activity.description && <p>{activity.description}</p>}
                            </div>
                            {index < activities.length - 1 && <div className="td-event-line" />}
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                </div>

                <div className="td-right-column">
                  <section className="td-card">
                    <h2 className="td-card-title-text">Case Details</h2>
                    <dl className="td-details-list">
                      <div>
                        <dt>Status</dt>
                        <dd>{`Current status: ${formatCaseStatusLabel(ticket.statuscode)}`}</dd>
                      </div>
                      <div>
                        <dt>Priority</dt>
                        <dd>{`Priority level: ${formatCasePriorityLabel(ticket.prioritycode)}`}</dd>
                      </div>
                      <div>
                        <dt>Assigned To</dt>
                        <dd>{ticket._ownerid_value ?? 'Unassigned'}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatDate(ticket.createdon)}</dd>
                      </div>
                      <div>
                        <dt>Last Updated</dt>
                        <dd>{formatDate(ticket.modifiedon)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="td-card" aria-labelledby="attachments-heading">
                    <h2 id="attachments-heading" className="td-card-title-text">
                      Attachments
                    </h2>
                    {attachments.length === 0 ? (
                      <p className="td-muted">No attachments.</p>
                    ) : (
                      <ul className="td-attachments">
                        {attachments.map((attachment) => (
                          <li key={attachment.annotationid}>
                            <div>
                              <strong>{attachment.filename}</strong>
                              <span>{attachment.mimetype || 'Attachment'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDownload(attachment.annotationid)}
                              aria-label={`Download ${attachment.filename}`}
                            >
                              Download
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="td-card">
                    <h2 className="td-card-title-text">Assigned Agent</h2>
                    <div className="td-agent">
                      <div className="td-avatar td-avatar-lg">{initialsFromName(agentName)}</div>
                      <div>
                        <p>{agentName}</p>
                        <span>Support Agent</span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
