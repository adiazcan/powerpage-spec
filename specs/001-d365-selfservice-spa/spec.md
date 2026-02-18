# Feature Specification: Customer Self-Service SPA for Dynamics 365 Customer Service

**Feature Branch**: `001-d365-selfservice-spa`
**Created**: February 18, 2026
**Status**: Draft
**Input**: User description: "Customer Self-Service SPA for Dynamics 365 Customer Service — authenticated customers can view and search support tickets, track status, and create new service requests."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View My Support Tickets (Priority: P1)

An authenticated customer visits the portal and immediately sees a list of all their support tickets, sorted by most recently updated. They can quickly scan ticket numbers, titles, statuses, and last update times to understand the state of their requests — without calling support.

**Why this priority**: The ticket list is the core value proposition. Without it, no other portal capability delivers self-service value. It directly reduces the most common support call: "What is the status of my case?"

**Independent Test**: Can be fully tested by logging in as an authenticated contact, navigating to the ticket list, and verifying that all tickets associated with that contact are displayed with correct columns, sorted by most recently updated first. An MVP is deliverable with just this story.

**Acceptance Scenarios**:

1. **Given** an authenticated customer with existing tickets, **When** they navigate to the portal home, **Then** they see a list of their tickets ordered by most recently updated, displaying ticket number, subject, status, priority, and last updated date.
2. **Given** an authenticated customer with no tickets, **When** they view the ticket list, **Then** they see a clear empty state with a prompt to create a new ticket.
3. **Given** an authenticated customer whose deployment has account-level visibility enabled, **When** they view the list, **Then** tickets from all contacts in their Account are also displayed.
4. **Given** an authenticated customer, **When** they attempt to access another customer's ticket URL directly, **Then** they receive an authorization error and no ticket data is exposed.

---

### User Story 2 - View Ticket Details (Priority: P2)

An authenticated customer selects a ticket from their list to see the full details: description, current status, priority, timeline activity, and any attached files. They can understand exactly what is happening with their request without contacting the support team.

**Why this priority**: Ticket details are the second most common trigger for inbound support calls. After seeing a ticket in the list, customers need enough detail to avoid calling in for clarification.

**Independent Test**: Can be tested independently by navigating to a ticket detail page and verifying it renders complete ticket data, timeline history, and attachments — and that unauthorized tickets are fully blocked.

**Acceptance Scenarios**:

1. **Given** a customer viewing their ticket list, **When** they click a ticket, **Then** the detail view displays: case number, subject, description, status, priority, opened date, last updated date, and the activity timeline in chronological order.
2. **Given** a ticket with attached files, **When** the customer views the ticket detail, **Then** they can see and download the attachments.
3. **Given** a customer on the detail page, **When** they navigate back, **Then** they return to the ticket list with their previous scroll position and filter state preserved.
4. **Given** a customer who manually enters a URL for a ticket they are not authorized to view, **When** the page loads, **Then** they see an authorization error and no ticket data is exposed.

---

### User Story 3 - Create a New Support Ticket (Priority: P3)

An authenticated customer needs help and submits a new support request through a guided form. They provide a subject, category, description, and optionally attach files. On success, they receive a confirmation with their new ticket number and a direct link to track it.

**Why this priority**: Ticket creation is the deflection mechanism for inbound intake channels (phone/email), but it needs the ticket list to be useful — customers must be able to track what they submit.

**Independent Test**: Can be tested end-to-end by submitting the creation form as an authenticated contact and confirming: a Case appears in Dynamics 365 with the correct association, and the confirmation screen shows the ticket number with a working link to the detail view.

**Acceptance Scenarios**:

1. **Given** an authenticated customer on the create ticket form, **When** they fill in all required fields (subject, category, description) and submit, **Then** a new Case is created in Dynamics 365 linked to their Contact and Account, and they see a confirmation with the ticket number and link.
2. **Given** a customer submitting with required fields missing, **When** they attempt to submit, **Then** inline validation errors appear without page reload and the form is not submitted.
3. **Given** a customer attaching a file that exceeds the size limit, **When** they try to submit, **Then** a clear error message explains the constraint and the form is not submitted.
4. **Given** a customer who successfully submits a ticket, **When** they click the link on the confirmation screen, **Then** they are taken directly to the ticket detail view for the newly created ticket.
5. **Given** a network or server error during submission, **When** the submit fails, **Then** the customer sees a user-friendly error message and all form data is preserved so they can retry without re-entering.

---

### Edge Cases

- What happens when a customer's session expires mid-form entry? Form data should be preserved where possible, and after re-authentication the user should be able to resume or re-submit.
- What happens if a customer is associated with multiple Accounts in Dynamics 365? The account association for new tickets must be deterministic and explicit.
- What happens if Dynamics 365 returns a server-side validation error during case creation (e.g., a required field missing on the D365 side)?
- How does pagination or infinite scroll behave when a customer has a very large number of tickets (100+)?
- How does the portal handle a Contact record that has been deactivated or merged in Dynamics 365?

## Requirements *(mandatory)*

### Functional Requirements

**Ticket List**

- **FR-List-01**: The system MUST display a list of support tickets (Cases) associated with the authenticated user's Contact record in Dynamics 365 Customer Service.
- **FR-List-02**: The system MUST support optional inclusion of tickets linked to the authenticated user's Account, configurable per deployment.
- **FR-List-03**: The ticket list MUST default to sorting by most recently updated date, descending.
- **FR-List-04**: The ticket list MUST display the following columns as a minimum: Ticket Number, Subject, Status, Priority, Created Date, Last Updated Date.
- **FR-List-05**: The ticket list MUST support filtering by Status (e.g., Active, Resolved, Cancelled), Priority, and Date Range (created or last updated).
- **FR-List-06**: The ticket list MUST support free-text search across ticket subject.
- **FR-List-07**: The ticket list MUST handle large ticket volumes through pagination or progressive loading.
- **FR-List-08**: The ticket list MUST display a clear empty state when no tickets exist.

**Ticket Details**

- **FR-Detail-01**: The system MUST provide a detail view displaying: Case Number, Subject, Description, Status, Priority, Opened Date, Last Updated Date, and Assigned Team/Queue (when available).
- **FR-Detail-02**: The detail view MUST display the case activity timeline in chronological order, showing customer-visible notes and status changes.
- **FR-Detail-03**: The detail view MUST display all attachments associated with the case, with download capability.
- **FR-Detail-04**: The system MUST enforce strict data scoping: authenticated users MUST only access tickets associated with their authorized Contact or Account. This scoping MUST be enforced at the data access layer, not solely in the UI.
- **FR-Detail-05**: Direct URL access to an unauthorized ticket MUST return an authorization error without exposing any ticket data or metadata.

**Create New Ticket**

- **FR-Create-01**: The system MUST provide a creation form with the following required fields: Subject (text, max 300 characters), Category/Type (selectable from a configurable list), and Description (text area, max 4,000 characters).
- **FR-Create-02**: The creation form MUST support an optional Priority field (selectable values: Low, Normal, High).
- **FR-Create-03**: The creation form MUST support optional file attachment upload (up to 3 files, max 10 MB each; accepted types: PDF, DOCX, PNG, JPG, TXT).
- **FR-Create-04**: On submission, the system MUST create a Case in Dynamics 365 Customer Service and associate it with the authenticated user's Contact record and their Account where applicable.
- **FR-Create-05**: After successful case creation, the system MUST display a confirmation screen showing the new Ticket Number and a direct link to the ticket detail view.
- **FR-Create-06**: Input MUST be validated client-side (immediate inline feedback) and server-side (before case creation). Server-side validation errors MUST be displayed inline next to the relevant field when the error can be mapped to a specific field; otherwise they MUST appear as a summary error banner at the top of the form.
- **FR-Create-07**: If a submission error occurs, the system MUST preserve all user-entered form data so the customer can retry without re-entering information.

**Authentication & Security**

- **FR-Auth-01**: All portal features MUST require authentication. Unauthenticated users MUST be redirected to the sign-in experience before accessing any portal page. Customer authentication MUST be handled through an existing enterprise SSO provider (B2B customers authenticate using their employer's credentials via the organization's identity system).
- **FR-Auth-02**: The application MUST enforce data scoping at the data-access layer, independent of UI rendering, to prevent unauthorized data access through direct API calls or URL manipulation.
- **FR-Auth-03**: All data transmitted between the customer's browser and the application MUST be encrypted in transit.
- **FR-Auth-04**: Dynamics 365 API credentials MUST never be exposed to the browser or client-side code.

### Key Entities

- **Contact**: The authenticated customer's record in Dynamics 365. Primary anchor for ticket ownership and data scoping. Key attributes: full name, email, associated Account.
- **Account**: The organization the Contact belongs to. Optionally extends ticket visibility to all contacts within the same Account, when account-level access is enabled.
- **Case (Ticket)**: The support request record in Dynamics 365 Customer Service. Contains subject, description, status, priority, created/updated dates, activity timeline, and attachments.
- **Activity / Timeline Entry**: An event record on a Case representing agent notes, emails, or status changes that are visible to the customer in the detail view. Internal-only notes MUST NOT be surfaced.
- **Attachment**: A file associated with a Case, uploaded by the customer during ticket creation or added by an agent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authenticated customers can view their full ticket list within 3 seconds of page load under normal operating conditions.
- **SC-002**: Navigation between the ticket list and ticket detail view completes in under 1 second without a full page reload.
- **SC-003**: Customers can complete new ticket creation — from opening the form to seeing the confirmation screen — in under 3 minutes for a typical request without attachments.
- **SC-004**: Zero unauthorized data exposure: no customer can access ticket data for contacts or accounts they are not associated with, as verified through security and penetration testing.
- **SC-005**: Inbound support volume for case status inquiries (calls and emails) decreases by at least 20% within 90 days of the portal going live.
- **SC-006**: New ticket form submission success rate exceeds 95% (excluding user-initiated abandonments).
- **SC-007**: The portal supports at least 500 concurrent authenticated users without measurable degradation in ticket list or detail load times.

## Assumptions

- Dynamics 365 Customer Service is already provisioned and configured with Case, Contact, and Account entities in the target environment.
- A server-side integration layer will mediate all communication between the SPA and Dynamics 365 APIs; Dynamics 365 credentials are never sent to the browser.
- The Category/Type list for ticket creation will be sourced from a configurable Dynamics 365 option set or lookup table managed by the support team.
- Customers will have pre-existing Contact records in Dynamics 365; the portal does not handle Contact self-registration or profile management.
- Agent-authored notes marked as "internal only" in Dynamics 365 will NOT be surfaced in the customer-facing activity timeline.
- Attachments are stored natively within Dynamics 365 (via Notes or SharePoint integration); no separate external file storage service is in scope.
- Email or push notifications triggered by portal actions (e.g., "your ticket was created") are handled by existing Dynamics 365 workflow automations and are out of scope for this feature.

## Out of Scope

- Knowledge base articles, forums, or CMS content pages
- Agent-facing features: case assignment, routing rules, queue management
- Real-time chat, voice, or omnichannel communication features
- Customer self-registration, password reset, or Contact profile editing
- Reporting or analytics dashboards for customers or support managers
