# Research: Customer Self-Service SPA for Dynamics 365

**Branch**: `001-d365-selfservice-spa` | **Date**: February 18, 2026

## R1: Power Pages SPA Hosting Model

**Decision**: Deploy as a Power Pages Code Site (SPA) using `pac pages upload-code-site`.

**Rationale**: Power Pages natively supports SPA hosting via PAC CLI since version 9.7.4.x. The SPA runs entirely client-side; Power Pages handles TLS, cookie-based session management, identity provider integration, and table permissions enforcement at the API layer. This eliminates the need for a custom backend — the Power Pages Web API (`/_api/`) acts as the server-side integration layer mediating all Dataverse access. Dynamics 365 credentials never reach the browser.

**Alternatives considered**:
- **Azure Static Web Apps + custom API**: Would require building and maintaining a separate backend for Dataverse authentication and authorization. Rejected because Power Pages already provides this out of the box with table permissions and web roles.
- **Traditional Power Pages site (Liquid)**: Would provide built-in forms and lists, but lacks the modern SPA experience (client-side routing, component architecture, fast transitions). Rejected because the spec requires sub-1-second navigation between views without full page reloads (SC-002).

## R2: Frontend Framework & Tooling

**Decision**: React 18+ with TypeScript, Vite as build tool, React Router for client-side routing.

**Rationale**: The user specified React. The official Power Pages sample (car-sales-website) uses React + TypeScript + Vite + React Router, establishing this as the validated stack. Vite provides fast HMR for local development and optimized production builds. TypeScript satisfies the Constitution's Code Quality principle (all public APIs typed).

**Alternatives considered**:
- **Angular**: Supported by Power Pages samples but not requested. Heavier framework for this scope.
- **Vue**: Supported but not requested.
- **Next.js**: SSR not compatible with Power Pages SPA model (client-side rendering only).

## R3: UI Component Library

**Decision**: Material-UI (MUI) v5/v6.

**Rationale**: The official Power Pages React sample uses Material-UI. MUI provides accessible components (WCAG 2.1 AA compliant with proper usage), a comprehensive design token system (theme, spacing, typography), and data display components (DataGrid for ticket list, Cards for detail). Aligns with Constitution Principle III (UX Consistency) through a single design system.

**Alternatives considered**:
- **Fluent UI (Microsoft)**: Would align with Microsoft product aesthetics but has a steeper learning curve and smaller community. The official Power Pages sample chose MUI, suggesting it's the preferred path.
- **Tailwind CSS (utility-only)**: Would require building all components from scratch. Rejected for scope efficiency.
- **shadcn/ui**: Good option but less battle-tested for enterprise data-heavy scenarios.

## R4: Form Handling & Validation

**Decision**: Formik + Yup for form management and validation.

**Rationale**: The official Power Pages React sample includes Formik and Yup as dependencies. Formik handles form state, submission, and error display. Yup provides declarative schema validation for both client-side and pre-submission validation (FR-Create-06). Supports inline field-level errors and form-level error banners.

**Alternatives considered**:
- **React Hook Form + Zod**: Lighter weight and gaining popularity, but deviating from the sample stack without clear benefit.
- **Native React state**: Too verbose for the multi-field create form with complex validation rules.

## R5: Authentication & Authorization Model

**Decision**: Use Power Pages built-in authentication via `window["Microsoft"].Dynamic365.Portal.User` for user context. Use anti-forgery token (`__RequestVerificationToken`) for CSRF protection on all write operations. Configure Microsoft Entra ID as the identity provider for enterprise SSO (B2B).

**Rationale**: Power Pages SPA sites use the same security model as traditional Power Pages. Authentication is session-based (cookie). The user object is injected into `window["Microsoft"].Dynamic365.Portal.User` providing `userName`, `firstName`, `lastName`, and tenant info. All Web API calls are authenticated via the session cookie — no bearer tokens needed in production. Write operations require an anti-forgery token fetched from `/_layout/tokenhtml`. Data scoping (FR-Auth-02) is enforced server-side through table permissions and web roles, not client-side code.

**Key implementation details**:
- Identity provider: Microsoft Entra ID configured in Power Pages > Security > Identity providers
- Login flow: POST to `/Account/Login/ExternalLogin` with `__RequestVerificationToken` and provider URL
- Logout: Redirect to `/Account/Login/LogOff?returnUrl=%2F`
- Unauthenticated redirect: Check `window["Microsoft"].Dynamic365.Portal.User.userName`; if empty, redirect to login
- Anti-forgery token: Fetch from `/_layout/tokenhtml`, parse the `value` attribute from the HTML response

**Alternatives considered**:
- **MSAL.js direct authentication**: Not compatible with Power Pages (uses Entra v1 endpoints, MSAL requires v2). Only applicable for localhost development.
- **Custom JWT middleware**: Unnecessary — Power Pages manages the entire auth pipeline.

## R6: Data Access via Power Pages Web API

**Decision**: Use Power Pages Web API (`/_api/`) for all Dataverse CRUD operations. Use OData query parameters for filtering, sorting, and pagination. Use FetchXML for complex queries when OData is insufficient.

**Rationale**: The Power Pages Web API is the only supported data access method for SPA code sites. It provides a subset of Dataverse OData capabilities: `$select`, `$filter`, `$orderby`, `$top`, `$expand`, `$count`, `$apply`, and FetchXML. All queries respect table permissions — no data is returned that the authenticated user's web role doesn't permit. This enforces FR-Auth-02 (data scoping at data-access layer) without custom backend code.

**Key implementation details**:
- Entity set names (not logical names) in URLs: e.g., `/_api/incidents` for Cases
- Anti-forgery token required as `__RequestVerificationToken` header on POST/PATCH/DELETE
- Session cookie handles authentication automatically
- Pagination: Use `$top` + `$skip` or FetchXML paging cookie for large result sets
- Site settings required: `Webapi/incident/enabled = true`, `Webapi/incident/fields = <field list>`
- Also enable for: `annotation` (attachments), `activitypointer` or specific activity types (timeline)

**Alternatives considered**:
- **Direct Dataverse Web API**: Not accessible from browser; requires server-side auth with app registration.
- **Custom Azure Function proxy**: Unnecessary complexity; Power Pages Web API already enforces table permissions.

## R7: Dataverse Table Mappings (D365 Customer Service)

**Decision**: Map feature entities to standard Dynamics 365 Customer Service tables.

| Feature Entity | Dataverse Table (Logical Name) | EntitySetName | Key Fields |
|---|---|---|---|
| Case (Ticket) | `incident` | `incidents` | `incidentid`, `ticketnumber`, `title`, `description`, `statuscode`, `prioritycode`, `createdon`, `modifiedon` |
| Contact | `contact` | `contacts` | `contactid`, `fullname`, `emailaddress1` |
| Account | `account` | `accounts` | `accountid`, `name` |
| Activity (Timeline) | `activitypointer` | `activitypointers` | `activityid`, `subject`, `activitytypecode`, `createdon`, `description` |
| Annotation (Attachment) | `annotation` | `annotations` | `annotationid`, `filename`, `mimetype`, `documentbody`, `notetext`, `subject` |
| Case Category | `incident` field `casetypecode` or custom lookup | — | Configurable option set or lookup table |

**Rationale**: These are standard D365 Customer Service entities. Using standard tables avoids custom table creation and aligns with the spec assumption that D365 CS is already provisioned.

## R8: Local Development Setup

**Decision**: Use Vite dev server with proxy configuration for `/_api` calls to the Power Pages site URL. Authenticate via ADAL.js (Entra v1) with SPA redirect URI on localhost. Enable bearer authentication site settings in development environment only.

**Rationale**: Power Pages documents this exact pattern for local development. Vite proxy avoids CORS issues. ADAL.js is required because Power Pages uses Entra v1 endpoints (MSAL.js is not compatible).

**Key configuration**:
```js
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/_api': {
        target: 'https://<site>.powerappsportals.com',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
```

**Site settings for dev**:
- `Authentication/BearerAuthentication/Enabled = true`
- `Authentication/BearerAuthentication/Protocol = OpenIdConnect`
- `Authentication/BearerAuthentication/Provider = AzureAD`

## R9: File Attachments Handling

**Decision**: Upload attachments as Dataverse Annotations (Notes) linked to the Case record using base64 encoding via the Web API.

**Rationale**: The Power Pages Web API supports creating annotations with `documentbody` (base64), `filename`, and `mimetype`. This aligns with the spec assumption that attachments are stored natively within D365 (via Notes). The Web API write operations documentation shows the exact JSON structure for annotation creation. File size validation (10 MB max per FR-Create-03) is enforced client-side before base64 conversion and server-side via Dataverse column limits.

**Key constraints**:
- Max 3 files per ticket creation (FR-Create-03)
- Max 10 MB each
- Accepted types: PDF, DOCX, PNG, JPG, TXT
- Base64 encoding increases payload size ~33%: effective server limit must accommodate ~13.3 MB per file

## R10: Pagination Strategy for Large Ticket Volumes

**Decision**: Server-side pagination using `$top` and `$skip` OData parameters with a page size of 25. Display total count via `$count=true`. Provide page navigation controls.

**Rationale**: The spec edge case identifies 100+ tickets as a concern. The Web API supports `$count` (up to 5,000 count) and `$top`/`$skip` for pagination. Server-side pagination is preferred over client-side because it reduces payload size and initial load time. A page size of 25 balances between too many API calls and too large a response.

**Alternatives considered**:
- **Infinite scroll**: More complex to implement, harder to maintain scroll position on back navigation (FR-Detail-03). Rejected.
- **Client-side pagination (load all)**: Not viable for customers with hundreds of tickets. Rejected.
- **FetchXML paging cookie**: More complex but may be needed if `$skip` performance degrades at high offsets. Reserved as fallback.

## R11: Activity Timeline Filtering (Internal Notes)

**Decision**: Filter timeline entries server-side using OData `$filter` to exclude internal-only annotations. Use the `visibility` or custom field on activity records to determine customer-visible entries.

**Rationale**: The spec explicitly requires that "Agent-authored notes marked as internal only in Dynamics 365 will NOT be surfaced" (Assumptions). In D365 Customer Service, the `annotation` entity has an `isdocument` field but no built-in "internal" flag. Internal notes are typically `annotation` records with specific subjects or are controlled via a custom field. The table permissions configuration in Power Pages should be set up to exclude internal notes — this is a deployment configuration concern, not an application code concern.

**Implementation approach**: Configure table permissions for `annotation` with appropriate filters, and/or use `$filter` in the query to exclude records marked as internal.

## R12: Power Pages Configuration Requirements

**Decision**: Document all required Power Pages configuration as infrastructure setup separate from the SPA codebase.

**Required site settings**:
| Setting | Value | Purpose |
|---|---|---|
| `Webapi/incident/enabled` | `true` | Enable Case Web API |
| `Webapi/incident/fields` | `ticketnumber,title,description,statuscode,prioritycode,createdon,modifiedon,customerid,statecode` | Case fields accessible via API |
| `Webapi/annotation/enabled` | `true` | Enable Annotation Web API (attachments) |
| `Webapi/annotation/fields` | `filename,mimetype,documentbody,notetext,subject,objectid,isdocument` | Annotation fields |
| `Webapi/activitypointer/enabled` | `true` | Enable Activity Web API (timeline) |
| `Webapi/activitypointer/fields` | `subject,description,activitytypecode,createdon,actualstart,actualend` | Activity fields |

**Required table permissions**:
| Table | Access Type | Scope | Web Roles |
|---|---|---|---|
| `incident` | Read, Create | Contact (own) + optionally Account (parent) | Authenticated Users |
| `annotation` | Read, Create | Parent (via incident) | Authenticated Users |
| `activitypointer` | Read | Parent (via incident) | Authenticated Users |

**Required web roles**:
- "Authenticated Users" — assigned to all authenticated contacts

## R13: Session Expiry & Form Data Preservation

**Decision**: Detect session expiry by checking API response status (401/403). Preserve form data in `sessionStorage` before redirecting to login. Restore on return.

**Rationale**: The spec edge case asks about mid-form session expiry. Power Pages session is cookie-based with a configurable timeout. On expiry, Web API calls return 401/403. The SPA should intercept these, save form state to `sessionStorage`, redirect to login, and restore state post-authentication. `sessionStorage` is appropriate because it's scoped to the tab and cleared on tab close (security).

## R14: Deployment Pipeline

**Decision**: Use PAC CLI `pac pages upload-code-site` for deployment. Include `powerpages.config.json` in project root. Build with `npm run build` before upload.

**Rationale**: This is the standard and only deployment mechanism for Power Pages SPA sites. The config file specifies site name, landing page, and compiled path.

```json
{
  "siteName": "Customer Self-Service Portal",
  "defaultLandingPage": "index.html",
  "compiledPath": "dist"
}
```
