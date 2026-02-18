import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineSeparator,
} from '@mui/lab';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ApiError } from '@/services/api-client';
import { listActivities } from '@/services/activities';
import { getAnnotation, listAnnotations } from '@/services/annotations';
import { getIncident } from '@/services/incidents';
import type { Activity, Annotation, Case } from '@/types';
import { formatCasePriorityLabel, formatCaseStatusLabel, formatDate } from '@/utils/formatters';

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
        <Typography variant="h4">Ticket Details</Typography>
        <Button variant="outlined" onClick={() => navigate(-1)} aria-label="Back to tickets">
          Back to tickets
        </Button>
      </Box>

      {error && (
        <Box>
          <ErrorBanner message={error} />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {!loading && !error && ticket && (
        <>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">{ticket.ticketnumber}</Typography>
              <Typography variant="h5">{ticket.title}</Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip label={formatCaseStatusLabel(ticket.statuscode)} color="primary" />
                <Chip label={formatCasePriorityLabel(ticket.prioritycode)} variant="outlined" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Opened: {formatDate(ticket.createdon)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last updated: {formatDate(ticket.modifiedon)}
              </Typography>
              {assignedOwner && (
                <Typography variant="body2" color="text.secondary">
                  Assigned Team/Queue: {assignedOwner}
                </Typography>
              )}
            </Stack>
          </Paper>

          <Paper component="section" aria-labelledby="ticket-description-heading" sx={{ p: 3 }}>
            <Typography id="ticket-description-heading" variant="h6" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1">{ticket.description || 'No description provided.'}</Typography>
          </Paper>

          <Paper component="section" aria-labelledby="activity-timeline-heading" sx={{ p: 3 }}>
            <Typography id="activity-timeline-heading" variant="h6" gutterBottom>
              Activity Timeline
            </Typography>
            {activities.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No timeline entries.
              </Typography>
            ) : (
              <Timeline position="right" sx={{ p: 0, m: 0 }}>
                {activities.map((activity, index) => (
                  <TimelineItem key={activity.activityid}>
                    <TimelineSeparator>
                      <TimelineDot />
                      {index < activities.length - 1 ? <TimelineConnector /> : null}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography data-testid="timeline-subject" fontWeight={600}>
                        {activity.subject || activity.activitytypecode}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(activity.createdon)}
                      </Typography>
                      {activity.description && <Typography variant="body2">{activity.description}</Typography>}
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            )}
          </Paper>

          <Paper component="section" aria-labelledby="attachments-heading" sx={{ p: 3 }}>
            <Typography id="attachments-heading" variant="h6" gutterBottom>
              Attachments
            </Typography>
            {attachments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No attachments.
              </Typography>
            ) : (
              <List disablePadding>
                {attachments.map((attachment) => (
                  <ListItem
                    key={attachment.annotationid}
                    divider
                    secondaryAction={
                      <Button
                        variant="text"
                        onClick={() => handleDownload(attachment.annotationid)}
                        aria-label={`Download ${attachment.filename}`}
                      >
                        Download
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={attachment.filename}
                      secondary={attachment.mimetype || 'Attachment'}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}
