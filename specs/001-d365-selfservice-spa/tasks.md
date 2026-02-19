# Tasks: Customer Self-Service SPA for Dynamics 365 Customer Service

**Input**: Design documents from `/specs/001-d365-selfservice-spa/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Per Constitution Principle II (Testing Standards), tests are MANDATORY and MUST be written before implementation (TDD). Every FR-* has a corresponding acceptance test. Test tasks appear before implementation tasks within each phase.

**Organization**: Tasks are grouped by user story to enable independent implementation, testing, and delivery of each story.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no blocking dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US3); omitted for Setup, Foundational, and Polish phases
- All paths are relative to repository root

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create project scaffold, install dependencies, configure tooling

- [X] T001 Initialize npm project and install all dependencies (React 18, TypeScript 5, Vite, React Router, MUI v6, Formik, Yup, Vitest, React Testing Library, Playwright) in package.json
- [X] T002 [P] Configure tsconfig.json with strict TypeScript (strict: true, target ESNext, module bundler, paths for src aliases)
- [X] T003 [P] Configure .eslintrc.cjs (TypeScript + React rules) and .prettierrc
- [X] T004 Configure vite.config.ts with Power Pages dev proxy (/_api, /_layout, /Account → site URL) and Vitest setup per research.md R8; configure `test.coverage.provider: 'v8'` and `test.coverage.thresholds` (`lines: 80, functions: 80, branches: 80, statements: 80`) to enforce Constitution Principle II gate; add `--coverage` flag to the `"test"` npm script in package.json
- [X] T005 [P] Configure playwright.config.ts for E2E tests targeting http://localhost:5173
- [X] T006 Create index.html SPA entry point with `<div id="root">` and public/ static assets directory
- [X] T007 [P] Create powerpages.config.json with siteName, defaultLandingPage index.html, and compiledPath dist per research.md R14

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by ALL user stories — auth, API client, routing shell, shared types

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Infrastructure

> **Write these tests FIRST. Verify they FAIL before any implementation tasks below. (Constitution Principle II)**

- [X] T008 [P] Write unit tests for api-client.ts (CSRF header injection on POST/PATCH/DELETE, 401/403 error propagation, JSON error parsing) in tests/unit/services/api-client.test.ts
- [X] T009 [P] Write unit tests for useAuth.ts hook (returns PortalUser from window["Microsoft"].Dynamic365.Portal.User, returns null when unauthenticated) in tests/unit/hooks/useAuth.test.ts
- [X] T010 [P] Write unit tests for useAntiForgeryToken.ts hook (fetches token from /_layout/tokenhtml, caches result, returns token string) in tests/unit/hooks/useAntiForgeryToken.test.ts
- [X] T011 [P] Write component test for AuthGuard.tsx (redirects to /Account/Login when unauthenticated, renders children when PortalUser is present) in tests/component/AuthGuard.test.tsx

### Implementation for Foundational Infrastructure

- [X] T012 Define all TypeScript interfaces and enums per data-model.md (Case, CaseStatus, CaseState, CasePriority, CaseCreatePayload, Activity, Annotation, AnnotationCreatePayload, PortalUser, PaginatedResponse, TicketListFilters, CaseTypeOption) in src/types/index.ts
- [X] T013 [P] Create MUI theme configuration with design tokens (primary/secondary palette, typography scale, spacing) in src/theme/index.ts
- [X] T014 Implement base fetch wrapper: inject __RequestVerificationToken header on write operations, parse OData error responses, propagate 401/403 as typed errors, support $select/$filter/$orderby/$top/$skip/$count in src/services/api-client.ts
- [X] T015 [P] Implement portal auth state hook reading window["Microsoft"].Dynamic365.Portal.User and returning typed PortalUser or null in src/hooks/useAuth.ts
- [X] T016 [P] Implement anti-forgery token hook: fetch from /_layout/tokenhtml, parse value attribute from HTML response, cache in module-level variable in src/hooks/useAntiForgeryToken.ts
- [X] T017 Implement route protection component: read useAuth, if unauthenticated redirect to /Account/Login/ExternalLogin with return URL, otherwise render children in src/components/AuthGuard.tsx
- [X] T018 [P] Implement login/logout button using Power Pages auth paths (/Account/Login/ExternalLogin for login, /Account/Login/LogOff?returnUrl=/ for logout) in src/components/AuthButton.tsx
- [X] T019 Implement app shell with MUI AppBar header (site title + AuthButton), main content outlet, and footer in src/components/Layout.tsx
- [X] T020 Implement root App component with React Router routes: / → TicketList, /tickets/:id → TicketDetail, /tickets/new → CreateTicket, /tickets/:id/confirm → Confirmation; wrap all routes in AuthGuard and Layout in src/App.tsx
- [X] T021 Create application entry point mounting App with MUI ThemeProvider and React.StrictMode in src/main.tsx and minimal CSS reset in src/index.css

**Checkpoint**: Foundation complete — all user story phases can now begin in parallel

---

## Phase 3: User Story 1 — View My Support Tickets (Priority: P1) 🎯 MVP

**Goal**: Authenticated customers see a paginated, filterable, searchable list of their support tickets sorted by most recently updated.

**Independent Test**: Log in as an authenticated Contact → navigate to `/` → verify the ticket list renders with columns (Ticket #, Subject, Status, Priority, Created, Last Updated) sorted by `modifiedon desc`; empty state message appears when the contact has no tickets; applying status/priority/date filters updates results; free-text search filters by subject; pagination controls advance pages; an authenticated user cannot see tickets belonging to a different contact.

### Tests for User Story 1

> **Write these tests FIRST. Verify they FAIL before any implementation tasks below. (Constitution Principle II)**

- [X] T022 [P] [US1] Write unit tests for listIncidents: OData query param composition ($select, $filter, $orderby, $top, $skip, $count), handling of PaginatedResponse shape, and error propagation in tests/unit/services/incidents.test.ts
- [X] T023 [P] [US1] Write unit tests for useTickets.ts hook: initial default state, filter updates, page transitions, search text debounce, and reset behavior in tests/unit/hooks/useTickets.test.ts
- [X] T024 [P] [US1] Write component test for TicketList.tsx: renders ticket rows with formatted columns, shows LoadingSpinner during fetch, shows EmptyState with no results, shows ErrorBanner on API error, filter controls trigger state updates in tests/component/TicketList.test.tsx
- [X] T025 [P] [US1] Write E2E tests covering US1 acceptance scenarios: authenticated list view, empty state, status filter, search, pagination, and unauthorized access rejection in tests/e2e/ticket-list.spec.ts

### Implementation for User Story 1

- [X] T026 [P] [US1] Implement date (ISO 8601 → locale string), CaseStatus label, CasePriority label, and CaseState label formatters in src/utils/formatters.ts
- [X] T027 [P] [US1] Create reusable MUI CircularProgress loading spinner component in src/components/LoadingSpinner.tsx
- [X] T028 [P] [US1] Create reusable empty state component with configurable icon, headline, and optional CTA button in src/components/EmptyState.tsx
- [X] T029 [P] [US1] Create reusable error banner component rendering MUI Alert with message and optional retry action in src/components/ErrorBanner.tsx
- [X] T030 [US1] Implement listIncidents function: build OData query from TicketListFilters ($select required fields, $filter for status/priority/dateFrom/dateTo/searchText contains, $orderby modifiedon desc, $top/$skip from page/pageSize, $count=true) in src/services/incidents.ts
- [X] T031 [US1] Implement useTickets hook: manage TicketListFilters state, debounce search input (300 ms), call listIncidents, expose tickets/totalCount/loading/error/filters/setFilters/setPage in src/hooks/useTickets.ts
- [X] T032 [US1] Implement TicketList page: MUI Table with columns (ticketnumber, title, statuscode, prioritycode, createdon, modifiedon) formatted via formatters.ts, filter panel (status select, priority select, date-range pickers), free-text search input, MUI Pagination, LoadingSpinner, EmptyState (with link to /tickets/new), ErrorBanner in src/pages/TicketList.tsx

**Checkpoint**: US1 fully functional and independently testable. Deployable as portal MVP.

---

## Phase 4: User Story 2 — View Ticket Details (Priority: P2)

**Goal**: Authenticated customers view complete case details, chronological activity timeline, and downloadable attachments for any ticket they own.

**Independent Test**: Navigate to `/tickets/<incidentid>` as an authorized Contact → verify all case fields render (case number, subject, description, status, priority, opened/updated dates), timeline entries appear in `createdon asc` order with no internal-only notes, attached files list is shown with working download, back navigation returns to the ticket list with scroll position and filter state preserved; navigating directly to a ticket URL for a different contact's case renders an authorization error and exposes no ticket data.

### Tests for User Story 2

> **Write these tests FIRST. Verify they FAIL before any implementation tasks below. (Constitution Principle II)**

- [X] T033 [P] [US2] Write unit tests for listActivities: OData filter by _regardingobjectid_value, orderby createdon asc, and response mapping to Activity interface in tests/unit/services/activities.test.ts
- [X] T034 [P] [US2] Write unit tests for listAnnotations (filter by _objectid_value, isdocument flag) and getAnnotation (full fetch with documentbody for download) in tests/unit/services/annotations.test.ts
- [X] T035 [US2] Write unit tests for getIncident: fetch by incidentid with $select full detail fields (including `_ownerid_value`), 403 → authorization error, 404 → not-found error in tests/unit/services/incidents.test.ts _(extends same file as T022 — do not run concurrently with T022)_
- [X] T036 [P] [US2] Write component test for TicketDetail.tsx: renders all case header fields including Assigned Team/Queue when present, renders timeline entries in order, renders attachment list, download button triggers blob download, back button renders, 403 renders authorization error with no data in tests/component/TicketDetail.test.tsx
- [X] T037 [P] [US2] Write E2E tests covering US2 acceptance scenarios: detail view fields, attachment download, back navigation preserving list state, unauthorized URL rejection in tests/e2e/ticket-detail.spec.ts

### Implementation for User Story 2

- [X] T038 [P] [US2] Implement listActivities function: GET /_api/activitypointers with $select (activityid, subject, description, activitytypecode, createdon), $filter _regardingobjectid_value eq incidentid, $orderby createdon asc in src/services/activities.ts
- [X] T039 [P] [US2] Implement listAnnotations (GET /_api/annotations $filter _objectid_value, $select summary fields without documentbody) and getAnnotation (GET /_api/annotations(id) $select with documentbody for download) in src/services/annotations.ts
- [X] T040 [US2] Add getIncident function to src/services/incidents.ts: GET /_api/incidents(id) $select full detail fields (incidentid, ticketnumber, title, description, statuscode, prioritycode, statecode, createdon, modifiedon, casetypecode, _ownerid_value), propagate 403 as authorization error
- [X] T041 [US2] Implement TicketDetail page: case header (ticket number, subject, status chip, priority, dates, Assigned Team/Queue from `_ownerid_value` formatted display name when present), description section, activity timeline (MUI Timeline component, createdon asc), annotation list (filename, mimetype, download button using base64 blob URL), back button using React Router navigate(-1) passing location state to preserve TicketList scroll and filter position, 403/404 error state with ErrorBanner in src/pages/TicketDetail.tsx

**Checkpoint**: US2 fully functional and independently testable. US1 and US2 work together.

---

## Phase 5: User Story 3 — Create a New Support Ticket (Priority: P3)

**Goal**: Authenticated customers submit a new support request and receive a confirmation screen with their ticket number and a direct link to the detail view.

**Independent Test**: As an authenticated Contact, open `/tickets/new` → fill in subject, category, description → submit → verify a new Case record appears in Dynamics 365 linked to the contact's contactId and accountId; confirmation screen shows the correct ticket number; clicking the confirmation link navigates to `/tickets/<new-incidentid>`; submitting with missing required fields shows inline Yup validation errors without submission; attaching a file > 10 MB shows a size error; attaching a 4th file shows a count error; a network failure preserves all form data and shows an error banner.

### Tests for User Story 3

> **Write these tests FIRST. Verify they FAIL before any implementation tasks below. (Constitution Principle II)**

- [X] T042 [P] [US3] Write unit tests for file-validation.ts: accepted MIME type whitelist, 10 MB raw size limit, 3-file maximum count, returns typed validation errors in tests/unit/utils/file-validation.test.ts
- [X] T043 [US3] Write unit tests for createIncident: POST payload construction (CaseCreatePayload), CSRF header presence, incidentid extraction from OData-EntityId response header in tests/unit/services/incidents.test.ts _(extends same file as T022 and T035 — must not run concurrently with either)_
- [X] T044 [US3] Write unit tests for createAnnotation: POST payload construction with base64 documentbody and objectid_incident@odata.bind, CSRF header presence, 400 error propagation in tests/unit/services/annotations.test.ts _(extends same file as T034 — must not run concurrently with T034)_
- [X] T045 [P] [US3] Write component test for CreateTicket.tsx: Yup validation triggers for required fields and char limits, file size/type/count errors, successful submission calls createIncident + createAnnotation in sequence, 401 saves form to sessionStorage, server error shows ErrorBanner with form data preserved in tests/component/CreateTicket.test.tsx
- [X] T046 [P] [US3] Write E2E tests covering US3 acceptance scenarios: successful creation with confirmation, required field validation, file constraint errors, confirmation link navigation, network error form preservation in tests/e2e/create-ticket.spec.ts

### Implementation for User Story 3

- [X] T047 [P] [US3] Implement file validation: MIME type whitelist (application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/png, image/jpeg, text/plain), max 10 MB raw size per file, max 3 files total, return typed error messages per FR-Create-03 in src/utils/file-validation.ts
- [X] T048 [US3] Add createIncident function to src/services/incidents.ts: POST /_api/incidents with CaseCreatePayload, pass CSRF token header, return incidentid parsed from OData-EntityId response header
- [X] T049 [US3] Add createAnnotation function to src/services/annotations.ts: POST /_api/annotations with AnnotationCreatePayload (base64 documentbody, objectid_incident@odata.bind), pass CSRF token header per contracts/annotations.yaml
- [X] T050 [US3] Implement CreateTicket page: Formik+Yup form with subject (max 300), casetypecode select (static CaseTypeOption list), description textarea (max 4000), optional prioritycode select, optional file upload (validateFiles from file-validation.ts, max 3 × 10 MB); on submit call createIncident then createAnnotation for each file; on 401 save form values to sessionStorage and redirect to login; restore from sessionStorage on mount; server errors show ErrorBanner with form data preserved (FR-Create-07); navigate to /tickets/:id/confirm on success in src/pages/CreateTicket.tsx
- [X] T051 [US3] Implement Confirmation page: display new ticket number (from router location state), link to /tickets/:incidentid, and button to return to ticket list in src/pages/Confirmation.tsx

**Checkpoint**: All three user stories functional. Full portal feature complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration hardening, accessibility, and deployment validation

- [X] T052 [P] Add React Router error boundaries in src/App.tsx: 403 → authorization error page (no data), 404 → not-found page, unhandled network errors → ErrorBanner fallback
- [X] T053 [P] Accessibility audit across all pages: keyboard navigation focus order, MUI aria-labels on interactive elements, color contrast ratio (WCAG 2.1 AA), screen reader landmarks — document findings and apply fixes in src/pages/ and src/components/
- [X] T054 Run quickstart.md validation checklist (all 15 items) against the deployed Power Pages site and mark each item pass/fail in specs/001-d365-selfservice-spa/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Phase 2 completion
  - Can proceed in priority order (P1 → P2 → P3) or in parallel across team members
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Depends On | Notes |
|-------|-----------|-------|
| US1 (P1) | Phase 2 complete | No dependency on US2 or US3 — fully independent |
| US2 (P2) | Phase 2 complete | Reads incident by ID; shares incidents.ts file with US1 (T040 extends T030's file) |
| US3 (P3) | Phase 2 complete | Writes incident + annotations; extends both service files (T048, T049) |

### Within Each User Story

1. Write tests → Verify FAIL → Implement models/utilities → Implement services → Implement hooks → Implement pages → Verify tests PASS
2. Story complete before extending to next priority

### Parallel Opportunities Per Story

**Phase 1** — can run concurrently:
- T002 `tsconfig.json` + T003 `.eslintrc.cjs/.prettierrc` + T005 `playwright.config.ts` + T007 `powerpages.config.json`

**Phase 2 Tests** — all four can run concurrently:
- T008 `api-client.test.ts` + T009 `useAuth.test.ts` + T010 `useAntiForgeryToken.test.ts` + T011 `AuthGuard.test.tsx`

**Phase 2 Implementation** — these can run concurrently once T012 (types) completes:
- T013 `theme/index.ts` + T015 `useAuth.ts` + T016 `useAntiForgeryToken.ts` + T018 `AuthButton.tsx`

**Phase 3 Tests** — all four can run concurrently:
- T022–T025

**Phase 3 Shared Components** — run concurrently once T012 is done:
- T026 `formatters.ts` + T027 `LoadingSpinner.tsx` + T028 `EmptyState.tsx` + T029 `ErrorBanner.tsx`

**Phase 4 Tests** — T033, T034, T036, T037 can run concurrently (different files); T035 extends `incidents.test.ts` from T022 and must not start until T022 is complete:
- T033 `activities.test.ts` + T034 `annotations.test.ts` + T036 `TicketDetail.test.tsx` + T037 `ticket-detail.spec.ts` [all P with each other]
- T035 `incidents.test.ts` (getIncident additions) — sequential after T022

**Phase 4 Services** — can run concurrently:
- T038 `activities.ts` + T039 `annotations.ts`

**Phase 5 Tests** — T042, T045, T046 can run concurrently (different files); T043 must follow T022 + T035; T044 must follow T034:
- T042 `file-validation.test.ts` + T045 `CreateTicket.test.tsx` + T046 `create-ticket.spec.ts` [all P with each other]
- T043 `incidents.test.ts` (createIncident additions) — sequential after T022 and T035
- T044 `annotations.test.ts` (createAnnotation additions) — sequential after T034

**Phase 5 Utilities** — can run concurrently once T012 is done:
- T047 `file-validation.ts`

---

## Parallel Execution Examples

### User Story 1 (after T021 completes)

```
# Launch all US1 tests in parallel:
T022: Write unit tests for listIncidents → tests/unit/services/incidents.test.ts
T023: Write unit tests for useTickets → tests/unit/hooks/useTickets.test.ts
T024: Write component test for TicketList → tests/component/TicketList.test.tsx
T025: Write E2E test for ticket list → tests/e2e/ticket-list.spec.ts

# Then launch all US1 shared components in parallel:
T026: src/utils/formatters.ts
T027: src/components/LoadingSpinner.tsx
T028: src/components/EmptyState.tsx
T029: src/components/ErrorBanner.tsx
```

### User Story 2 (after T021 completes, can overlap with US1 if team capacity allows)

```
# Launch all US2 tests in parallel:
T033: tests/unit/services/activities.test.ts
T034: tests/unit/services/annotations.test.ts
T035: tests/unit/services/incidents.test.ts (getIncident tests)
T036: tests/component/TicketDetail.test.tsx
T037: tests/e2e/ticket-detail.spec.ts

# Then launch US2 services in parallel:
T038: src/services/activities.ts
T039: src/services/annotations.ts
```

### User Story 3 (after T021 completes)

```
# T042, T045, T046 can run in parallel (different files):
T042: tests/unit/utils/file-validation.test.ts
T045: tests/component/CreateTicket.test.tsx
T046: tests/e2e/create-ticket.spec.ts

# T043 and T044 must run sequentially (extend shared test files from earlier phases):
T043: tests/unit/services/incidents.test.ts — after T022 + T035 complete
T044: tests/unit/services/annotations.test.ts — after T034 complete

# Then implement utility independently:
T047: src/utils/file-validation.ts  ← no service dependencies
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `npm test` and verify all US1 tests pass; run quickstart.md checks 1–5
5. Deploy to Power Pages and validate end-to-end

### Incremental Delivery

| Increment | Phases | Value Delivered |
|-----------|--------|----------------|
| MVP | 1 + 2 + 3 | Customers can view and search all their tickets |
| Release 2 | + Phase 4 | Customers can view ticket details, timeline, and attachments |
| Release 3 | + Phase 5 | Customers can submit new support requests |
| Final | + Phase 6 | Production-hardened, accessible, deployment-validated portal |

### Parallel Team Strategy

With 3 developers, once Phase 2 is complete:

- **Developer A**: Phase 3 (US1 — ticket list)
- **Developer B**: Phase 4 (US2 — ticket detail)
- **Developer C**: Phase 5 (US3 — create ticket)

Each developer owns their story's test files, service functions, and page component. Service file extensions (T040, T048, T049) require coordination with Developer A who owns incidents.ts and annotations.ts initially — agree on a merge strategy before starting US2/US3 work.

---

## Task Count Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Phase 1: Setup | 7 | — |
| Phase 2: Foundational | 14 | — |
| Phase 3: US1 | 11 | P1 MVP |
| Phase 4: US2 | 9 | P2 |
| Phase 5: US3 | 10 | P3 |
| Phase 6: Polish | 3 | — |
| **Total** | **54** | |

## Notes

- **[P]** tasks operate on different files with no blocking dependencies — safe to execute concurrently
- **[Story]** label maps each task to a specific user story for traceability to spec.md
- Each user story phase is independently completable and testable — stop at any checkpoint to validate
- TDD order is mandatory per Constitution Principle II: write test → confirm FAIL → implement → confirm PASS
- Commit after each completed task or logical group of [P] tasks
- File extensions to existing service files (T040, T048, T049) must not break existing tests from prior phases
- Power Pages table permissions enforce server-side data scoping (FR-Auth-02) — the SPA enforces it additionally in UI but does NOT replace platform enforcement
- MSAL.js is NOT compatible with Power Pages (Entra v1 endpoints); use ADAL.js for local dev bearer auth only (R8)
- `window["Microsoft"].Dynamic365.Portal.User` provides contactId and accountId — never query the Contact Web API for auth context
