# Data Model: Customer Self-Service SPA for Dynamics 365

**Branch**: `001-d365-selfservice-spa` | **Date**: February 18, 2026

## Entity Relationship Overview

```
┌──────────┐      1:N       ┌──────────┐      N:1       ┌──────────┐
│  Account │───────────────▶│ Contact  │◀───────────────│  Incident │
│          │                │          │   customerid    │  (Case)  │
└──────────┘                └──────────┘                └────┬─────┘
                                                             │
                                          ┌──────────────────┼──────────────────┐
                                          │ 1:N              │ 1:N              │ 1:N
                                    ┌─────▼──────┐    ┌──────▼───────┐   ┌──────▼───────┐
                                    │ Annotation │    │ Activity     │   │ Activity     │
                                    │(Attachment)│    │ (Email)      │   │ (Note)       │
                                    └────────────┘    └──────────────┘   └──────────────┘
```

## Entities

### Case (Incident)

**Dataverse Table**: `incident` | **EntitySetName**: `incidents`

| Field | Logical Name | Type | Required | Description |
|-------|-------------|------|----------|-------------|
| Case ID | `incidentid` | GUID (PK) | Auto | Primary key |
| Ticket Number | `ticketnumber` | String (100) | Auto | Auto-generated case number |
| Subject | `title` | String (300) | Yes | Case subject line |
| Description | `description` | Text (4000) | Yes | Detailed description |
| Status | `statuscode` | OptionSet | Auto | Case status (1=Active, 2=Resolved, 3=Cancelled) |
| State | `statecode` | OptionSet | Auto | State (0=Active, 1=Resolved, 2=Cancelled) |
| Priority | `prioritycode` | OptionSet | No | Priority (1=High, 2=Normal, 3=Low) |
| Case Type | `casetypecode` | OptionSet | Yes | Category/type of case |
| Customer (Contact) | `customerid` | Lookup (contact) | Yes | Owning contact |
| Account | `_customerid_value` via account | Lookup (account) | Optional | Associated account (derived from contact or explicit) |
| Created On | `createdon` | DateTime | Auto | Record creation timestamp |
| Modified On | `modifiedon` | DateTime | Auto | Last update timestamp |
| Assigned To | `_ownerid_value` | Lookup (team/user) | No | Owning team or agent GUID; use OData formatted-value annotation for display name (when available) |

**Validation Rules**:
- `title`: Required, max 300 characters (FR-Create-01)
- `description`: Required, max 4,000 characters (FR-Create-01)
- `casetypecode`: Required, must be a valid option set value (FR-Create-01)
- `prioritycode`: Optional, valid values: 1 (High), 2 (Normal), 3 (Low) (FR-Create-02)

**State Transitions**:
```
Active (0) ──▶ Resolved (1) ──▶ Cancelled (2)
                    │
                    ▼
              Reactivated → Active (0)
```

### Contact

**Dataverse Table**: `contact` | **EntitySetName**: `contacts`

| Field | Logical Name | Type | Required | Description |
|-------|-------------|------|----------|-------------|
| Contact ID | `contactid` | GUID (PK) | Auto | Primary key |
| Full Name | `fullname` | String (160) | Computed | Concatenated first + last |
| First Name | `firstname` | String (50) | No | First name |
| Last Name | `lastname` | String (50) | Yes | Last name |
| Email | `emailaddress1` | String (100) | Yes | Primary email |
| Account | `parentcustomerid` | Lookup (account) | No | Parent account |

**Notes**: Contact records are pre-existing (Assumption). The SPA reads contact info from `window["Microsoft"].Dynamic365.Portal.User` — not queried via Web API.

### Account

**Dataverse Table**: `account` | **EntitySetName**: `accounts`

| Field | Logical Name | Type | Required | Description |
|-------|-------------|------|----------|-------------|
| Account ID | `accountid` | GUID (PK) | Auto | Primary key |
| Name | `name` | String (160) | Yes | Organization name |

**Notes**: Used for account-level ticket visibility (FR-List-02). The account association is derived from the Contact's `parentcustomerid`. When account-level visibility is enabled, the ticket list query expands to include all Cases where `customerid` references any contact under the same account.

### Activity (Timeline Entry)

**Dataverse Table**: `activitypointer` | **EntitySetName**: `activitypointers`

| Field | Logical Name | Type | Required | Description |
|-------|-------------|------|----------|-------------|
| Activity ID | `activityid` | GUID (PK) | Auto | Primary key |
| Subject | `subject` | String (400) | No | Activity subject |
| Description | `description` | Text | No | Activity body |
| Activity Type | `activitytypecode` | String | Auto | Type: email, phonecall, task, annotation, etc. |
| Created On | `createdon` | DateTime | Auto | When the activity was created |
| Regarding | `regardingobjectid` | Lookup (incident) | Yes | Parent case |

**Filtering**: Only customer-visible activities are returned. Internal-only notes are excluded via table permission configuration (Assumption: agent internal notes are filtered server-side by table permissions or a visibility field).

### Annotation (Attachment)

**Dataverse Table**: `annotation` | **EntitySetName**: `annotations`

| Field | Logical Name | Type | Required | Description |
|-------|-------------|------|----------|-------------|
| Annotation ID | `annotationid` | GUID (PK) | Auto | Primary key |
| Subject | `subject` | String (500) | No | Note subject |
| Note Text | `notetext` | Text | No | Note body text |
| File Name | `filename` | String (255) | Conditional | Attachment filename (required if file attached) |
| MIME Type | `mimetype` | String (256) | Conditional | File content type |
| Document Body | `documentbody` | String (base64) | Conditional | Base64-encoded file content |
| Is Document | `isdocument` | Boolean | Auto | Whether annotation has an attachment |
| Regarding | `objectid` | Lookup (incident) | Yes | Parent case |
| Created On | `createdon` | DateTime | Auto | When created |

**Validation Rules (client-side, FR-Create-03)**:
- Max 3 attachments per creation form submission
- Max 10 MB per file (before base64 encoding)
- Accepted MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/png`, `image/jpeg`, `text/plain`

## TypeScript Interfaces

```typescript
// types/index.ts

export interface Case {
  incidentid: string;
  ticketnumber: string;
  title: string;
  description: string;
  statuscode: CaseStatus;
  statecode: CaseState;
  prioritycode: CasePriority;
  casetypecode: number;
  createdon: string;        // ISO 8601
  modifiedon: string;       // ISO 8601
  _customerid_value: string; // Contact ID
  _ownerid_value?: string;   // Owning team/user GUID (optional — absent when record has no explicit owner)
  "_ownerid_value@OData.Community.Display.V1.FormattedValue"?: string; // Display name for UI
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

// Note: customer relationship is set server-side by Power Pages table permissions
// (Contact scope using incident_customer_contacts) for the authenticated user.

export interface Activity {
  activityid: string;
  subject: string;
  description: string;
  activitytypecode: string;
  createdon: string;
}

export interface Annotation {
  annotationid: string;
  subject: string;
  notetext: string;
  filename: string;
  mimetype: string;
  documentbody: string;   // base64 — only populated on download request
  isdocument: boolean;
  createdon: string;
}

export interface AnnotationCreatePayload {
  notetext?: string;
  subject?: string;
  filename: string;
  mimetype: string;
  documentbody: string;   // base64
  "objectid_incident@odata.bind": string; // "/incidents(<incidentid>)"
}

export interface PortalUser {
  userName: string;
  firstName: string;
  lastName: string;
  contactId: string;
  accountId?: string;
}

export interface PaginatedResponse<T> {
  "@odata.count"?: number;
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

export interface CaseTypeOption {
  value: number;
  label: string;
}
```

## Data Scoping Rules

| Scenario | Query Filter | Enforcement |
|----------|-------------|-------------|
| Contact-level tickets | `$filter=_customerid_value eq '<contactid>'` | Table permissions: scope = Contact |
| Account-level tickets (optional) | `$filter=_customerid_value eq '<contactid>' or <account filter>` | Table permissions: scope = Account |
| Unauthorized ticket access | Web API returns 403 / empty result | Table permissions (server-side) |
| Attachments for a case | `$filter=_objectid_value eq '<incidentid>'` | Table permissions: scope = Parent (incident) |
| Timeline for a case | `$filter=_regardingobjectid_value eq '<incidentid>'` | Table permissions: scope = Parent (incident) |
