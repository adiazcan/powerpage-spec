# Implementation Plan: Customer Self-Service SPA for Dynamics 365 Customer Service

**Branch**: `001-d365-selfservice-spa` | **Date**: February 18, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-d365-selfservice-spa/spec.md`

## Summary

Build a React SPA deployed as a Power Pages Code Site that enables authenticated customers to view, search, and create support tickets against Dynamics 365 Customer Service. The SPA uses Power Pages Web API (`/_api/`) for all Dataverse CRUD operations, Power Pages built-in authentication (Microsoft Entra ID / enterprise SSO), and Power Pages table permissions for server-side data scoping. No custom backend required.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+  
**Primary Dependencies**: React, React Router, Material-UI (MUI), Formik, Yup, Vite  
**Storage**: Microsoft Dataverse (via Power Pages Web API `/_api/`). Tables: `incident`, `contact`, `account`, `annotation`, `activitypointer`  
**Testing**: Vitest (unit/component), React Testing Library (component), Playwright (integration/E2E)  
**Target Platform**: Power Pages Code Site (SPA, client-side rendering, deployed via PAC CLI `pac pages upload-code-site`)  
**Project Type**: Web (SPA — frontend only, no backend; Power Pages is the server layer)  
**Performance Goals**: Ticket list load <3s (SC-001), view-to-view navigation <1s (SC-002), ticket creation flow <3min (SC-003)  
**Constraints**: 500 concurrent authenticated users (SC-007), Power Pages Web API rate limits, Entra v1 endpoints only for local dev auth, base64 encoding for attachments (~33% payload overhead)  
**Scale/Scope**: ~5 pages/views (ticket list, ticket detail, create ticket, confirmation, error/auth), targeting enterprise B2B customers with pre-existing D365 Contact records

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | TypeScript enforces types at definition. ESLint + Prettier configured. Single Responsibility via component/service/hook separation. |
| II. Testing Standards | PASS | TDD workflow: Vitest + React Testing Library for unit/component, Playwright for E2E. Each FR-* maps to acceptance tests. 80% coverage gate applies. |
| III. UX Consistency | PASS | Material-UI provides unified design tokens (theme, spacing, typography). WCAG 2.1 AA via MUI accessibility defaults + manual review. |

**Gate Result**: PASS — Proceed to Phase 0.

### Post-Phase 1 Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | All API service functions typed. Data model fully typed with TypeScript interfaces. No duplication — shared API client and auth utilities. |
| II. Testing Standards | PASS | Contract tests defined for each Web API endpoint. Component tests for each page. E2E tests for each user story. |
| III. UX Consistency | PASS | Single MUI theme applied globally. All components use MUI tokens. Accessibility validated per component in data-model.md. |

**Gate Result**: PASS — Proceed to Phase 2 (tasks).

## Project Structure

### Documentation (this feature)

```text
specs/001-d365-selfservice-spa/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── incidents.yaml   # Case/Ticket Web API contract
│   ├── annotations.yaml # Attachment Web API contract
│   └── activities.yaml  # Timeline Web API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/          # Shared/reusable UI components
│   ├── AuthButton.tsx   # Login/logout button (per Power Pages pattern)
│   ├── AuthGuard.tsx    # Route protection — redirects unauthenticated users
│   ├── Layout.tsx       # App shell: header, nav, footer
│   ├── EmptyState.tsx   # Reusable empty state display
│   ├── ErrorBanner.tsx  # Form/API error display banner
│   └── LoadingSpinner.tsx
├── pages/               # Route-level page components
│   ├── TicketList.tsx   # US1: ticket list with filters, search, pagination
│   ├── TicketDetail.tsx # US2: ticket detail with timeline and attachments
│   ├── CreateTicket.tsx # US3: guided creation form
│   └── Confirmation.tsx # US3: post-creation confirmation
├── services/            # Data access layer (Power Pages Web API)
│   ├── api-client.ts    # Base fetch wrapper with anti-forgery token, error handling
│   ├── incidents.ts     # Case CRUD operations
│   ├── annotations.ts   # Attachment read/create operations
│   └── activities.ts    # Timeline read operations
├── hooks/               # Custom React hooks
│   ├── useAuth.ts       # Auth state from window["Microsoft"].Dynamic365.Portal.User
│   ├── useAntiForgeryToken.ts  # Token fetch and caching
│   └── useTickets.ts    # Ticket list state management (filters, pagination, search)
├── types/               # TypeScript type definitions
│   └── index.ts         # All entity interfaces (Case, Contact, Activity, etc.)
├── utils/               # Pure utility functions
│   ├── file-validation.ts  # Attachment type/size validation
│   └── formatters.ts    # Date, status, priority display formatters
├── theme/               # MUI theme configuration
│   └── index.ts         # Design tokens: colors, spacing, typography
├── App.tsx              # Root component with Router
├── main.tsx             # Entry point
└── index.css            # Global styles (minimal — MUI handles most)

tests/
├── unit/                # Vitest unit tests
│   ├── services/        # API client and service function tests
│   ├── hooks/           # Custom hook tests
│   └── utils/           # Utility function tests
├── component/           # React Testing Library component tests
│   ├── TicketList.test.tsx
│   ├── TicketDetail.test.tsx
│   ├── CreateTicket.test.tsx
│   └── AuthGuard.test.tsx
└── e2e/                 # Playwright E2E tests
    ├── ticket-list.spec.ts
    ├── ticket-detail.spec.ts
    └── create-ticket.spec.ts

public/                  # Static assets
index.html               # SPA entry point
package.json
tsconfig.json
vite.config.ts
powerpages.config.json   # Power Pages deployment config
.eslintrc.cjs            # ESLint configuration
.prettierrc              # Prettier configuration
```

**Structure Decision**: Single frontend SPA project (no backend). Power Pages serves as the backend, handling authentication, authorization, and Dataverse API mediation. The folder structure follows the car-sales-website sample pattern (src/components, src/pages) extended with services/, hooks/, types/, and utils/ for separation of concerns. Tests are separated from source in a top-level tests/ directory with unit/component/e2e subdirectories per Constitution Principle II.

## Complexity Tracking

No constitution violations to justify. The design uses:
- A single SPA project (no multi-project complexity)
- Standard libraries from the official Power Pages sample (React, MUI, Formik, Yup)
- Power Pages platform features for auth and data access (no custom backend)
- Direct service functions instead of repository/abstraction layers
