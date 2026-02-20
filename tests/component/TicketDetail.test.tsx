import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CasePriority, CaseState, CaseStatus } from '@/types';

vi.mock('@/services/incidents');
vi.mock('@/services/activities');
vi.mock('@/services/annotations');

import * as incidentsModule from '@/services/incidents';
import * as activitiesModule from '@/services/activities';
import * as annotationsModule from '@/services/annotations';
import { TicketDetail } from '@/pages/TicketDetail';
import { ApiError } from '@/services/api-client';

const mockTicket = {
  incidentid: 'inc-123',
  ticketnumber: 'CAS-00123-ABC',
  title: 'Unable to access billing portal',
  description: 'Customer reports login loop when opening billing portal.',
  statuscode: CaseStatus.InProgress,
  prioritycode: CasePriority.High,
  statecode: CaseState.Active,
  createdon: '2026-02-10T14:30:00Z',
  modifiedon: '2026-02-15T09:45:00Z',
  casetypecode: 2,
  _customerid_value: 'contact-1',
  _ownerid_value: 'owner-123',
  '_ownerid_value@OData.Community.Display.V1.FormattedValue': 'Support Queue A',
};

const mockActivities = [
  {
    activityid: 'act-1',
    subject: 'Case opened',
    description: 'Case created by customer.',
    activitytypecode: 'email',
    createdon: '2026-02-10T14:30:00Z',
  },
  {
    activityid: 'act-2',
    subject: 'Status changed to In Progress',
    description: 'Agent acknowledged issue.',
    activitytypecode: 'task',
    createdon: '2026-02-11T09:00:00Z',
  },
];

const mockAnnotations = [
  {
    annotationid: 'ann-1',
    subject: 'Attachment',
    notetext: '',
    filename: 'error-log.txt',
    mimetype: 'text/plain',
    documentbody: '',
    isdocument: true,
    createdon: '2026-02-10T15:00:00Z',
  },
];

function renderTicketDetail() {
  return render(
    <MemoryRouter initialEntries={['/tickets/inc-123']}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TicketDetail', () => {
  beforeEach(() => {
    vi.mocked(incidentsModule.getIncident).mockResolvedValue(mockTicket);
    vi.mocked(activitiesModule.listActivities).mockResolvedValue(mockActivities);
    vi.mocked(annotationsModule.listAnnotations).mockResolvedValue(mockAnnotations);
    vi.mocked(annotationsModule.getAnnotation).mockResolvedValue({
      ...mockAnnotations[0],
      documentbody: 'SGVsbG8=',
    });

    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(),
        writable: true,
      });
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: vi.fn(),
        writable: true,
      });
    }

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all case header fields including Assigned Team/Queue', async () => {
    renderTicketDetail();

    expect(await screen.findByText('CAS-00123-ABC')).toBeInTheDocument();
    expect(screen.getByText('Unable to access billing portal')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText(/Support Queue A/i)).toBeInTheDocument();
  });

  it('renders timeline entries in ascending order by createdon', async () => {
    renderTicketDetail();

    expect(await screen.findByText('Case opened')).toBeInTheDocument();
    const timelineSubjects = screen.getAllByTestId('timeline-subject').map((el) => el.textContent);
    expect(timelineSubjects).toEqual(['Case opened', 'Status changed to In Progress']);
  });

  it('renders attachment list and triggers file download', async () => {
    renderTicketDetail();

    expect(await screen.findByText('error-log.txt')).toBeInTheDocument();
    const downloadButton = screen.getByRole('button', { name: /download error-log.txt/i });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(annotationsModule.getAnnotation).toHaveBeenCalledWith('ann-1');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('renders back button', async () => {
    renderTicketDetail();

    const backButton = await screen.findByRole('button', { name: /back to tickets/i });
    expect(backButton).toBeInTheDocument();
  });

  it('renders authorization error and no data on 403', async () => {
    vi.mocked(incidentsModule.getIncident).mockRejectedValue(new ApiError(403, 'Forbidden'));

    renderTicketDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent(/not authorized/i);
    expect(screen.queryByText('CAS-00123-ABC')).not.toBeInTheDocument();
  });

  it('keeps ticket visible when timeline fetch fails with 403', async () => {
    vi.mocked(activitiesModule.listActivities).mockRejectedValue(new ApiError(403, 'Forbidden'));

    renderTicketDetail();

    expect(await screen.findByText('CAS-00123-ABC')).toBeInTheDocument();
    expect(screen.queryByText(/not authorized/i)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/related ticket data could not be loaded/i);
    expect(screen.getByText(/no timeline entries/i)).toBeInTheDocument();
  });
});
