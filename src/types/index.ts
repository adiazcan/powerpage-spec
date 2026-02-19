// ── Case (Incident) ──────────────────────────────────────────────────────────

export interface Case {
  incidentid: string;
  ticketnumber: string;
  title: string;
  description: string;
  statuscode: CaseStatus;
  statecode: CaseState;
  prioritycode: CasePriority;
  casetypecode: number;
  createdon: string; // ISO 8601
  modifiedon: string; // ISO 8601
  _customerid_value: string; // Contact ID
  _ownerid_value?: string; // Owning team/user GUID
  '_ownerid_value@OData.Community.Display.V1.FormattedValue'?: string;
}

export enum CaseStatus {
  InProgress = 1,
  OnHold = 2,
  WaitingForDetails = 3,
  Researching = 4,
  ProblemSolved = 5,
  Cancelled = 6,
}

export enum CaseState {
  Active = 0,
  Resolved = 1,
  Cancelled = 2,
}

export enum CasePriority {
  High = 1,
  Normal = 2,
  Low = 3,
}

export interface CaseCreatePayload {
  title: string;
  description: string;
  casetypecode: number;
  prioritycode?: CasePriority;
}

// ── Activity (Timeline Entry) ────────────────────────────────────────────────

export interface Activity {
  activityid: string;
  subject: string;
  description: string;
  activitytypecode: string;
  createdon: string;
}

// ── Annotation (Attachment) ──────────────────────────────────────────────────

export interface Annotation {
  annotationid: string;
  subject: string;
  notetext: string;
  filename: string;
  mimetype: string;
  documentbody: string; // base64 — only populated on download request
  isdocument: boolean;
  createdon: string;
}

export interface AnnotationCreatePayload {
  notetext?: string;
  subject?: string;
  filename: string;
  mimetype: string;
  documentbody: string; // base64
  'objectid@odata.bind': string; // "/incidents(<incidentid>)"
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface PortalUser {
  userName: string;
  firstName: string;
  lastName: string;
  contactId: string;
  accountId?: string;
}

// ── Pagination & Filters ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: T[];
}

export interface TicketListFilters {
  status?: CaseState;
  priority?: CasePriority;
  dateFrom?: string;
  dateTo?: string;
  searchText?: string;
  page: number;
  pageSize: number;
}

// ── Form Options ─────────────────────────────────────────────────────────────

export interface CaseTypeOption {
  value: number;
  label: string;
}
