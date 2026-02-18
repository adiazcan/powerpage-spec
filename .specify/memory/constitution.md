<!--
SYNC IMPACT REPORT
==================
Version change:   N/A (initial fill) → 1.0.0
Modified principles:
  - N/A (initial ratification — all sections replaced from template placeholders)
Added sections:
  - Core Principles: I. Code Quality, II. Testing Standards, III. UX Consistency
  - Code Quality Gates
  - Development Workflow
  - Governance
Removed sections:
  - N/A
Templates reviewed:
  - ✅ .specify/templates/plan-template.md  — Constitution Check section aligns with 3-gate model
  - ✅ .specify/templates/spec-template.md  — FR mandatory coverage aligns with Testing Standards
  - ⚠  .specify/templates/tasks-template.md — NOTE: template marks tests as OPTIONAL;
        Testing Standards principle mandates TDD. See tasks-template for updated guidance note.
  - ✅ .specify/templates/agent-file-template.md — No constitution references; no changes required
Deferred TODOs:  None
-->

# PowerPage Spec Constitution

## Core Principles

### I. Code Quality

All code produced in this project MUST meet the following quality standards:

- Code MUST be readable and self-documenting; logic that is not immediately obvious MUST
  include clarifying inline comments.
- Every function and module MUST follow the Single Responsibility Principle — one clear
  purpose, no hidden side effects.
- Duplication is prohibited; shared logic MUST be extracted into reusable, named units
  before a second call site is introduced.
- All public APIs MUST be typed and documented at point of definition.
- Code MUST pass linting and formatting checks with zero reported errors before review
  or merge. No lint suppressions without a written, co-located justification.

**Rationale**: Readable, well-structured code reduces long-term maintenance cost and
allows contributors to onboard without requiring extensive context transfer.

### II. Testing Standards (NON-NEGOTIABLE)

Testing is a first-class citizen and MUST NOT be deferred or treated as optional:

- Tests MUST be written before implementation (TDD). A failing test MUST exist before
  any feature code is authored.
- Every Functional Requirement (FR-*) in a spec MUST have at least one corresponding
  acceptance test that can be run in isolation.
- Integration tests MUST cover all inter-component boundaries and each user-story
  happy path.
- Test coverage MUST NOT regress below 80% for any changed module in a given increment.
- Flaky or non-deterministic tests MUST be fixed before the relevant branch is merged;
  they MUST NOT be disabled or skipped as a workaround.

**Rationale**: Consistent test discipline is the primary mechanism for validating spec
compliance and preventing regression without manual verification overhead.

### III. UX Consistency

All user-facing features MUST adhere to established UX patterns to avoid fragmenting the
user experience:

- Visual and interaction patterns MUST be consistent across all pages and components;
  new UI MUST reuse existing design tokens (colors, spacing, typography, iconography).
- Any deviation from an established pattern MUST be documented in the relevant spec and
  approved before implementation begins.
- Accessibility standards (WCAG 2.1 AA) MUST be met for all user-facing output.
- User journeys MUST be validated end-to-end (via acceptance scenarios) before a feature
  is marked complete.
- Component naming and behaviour contracts MUST remain stable across releases; breaking
  changes require a versioned migration path documented in the spec.

**Rationale**: Inconsistent UX fragments user trust and increases cognitive load.
Consistent patterns let users build accurate mental models and reduce support burden.

## Code Quality Gates

Every pull request MUST pass all of the following gates before it is eligible for merge:

- **Lint / Format**: Static analysis and auto-formatting checks MUST pass with zero errors.
- **Type Safety**: Type errors MUST be fully resolved. Suppression annotations
  (`@ts-ignore`, `# type: ignore`, etc.) MUST NOT be added without a co-located comment
  explaining why the suppression is necessary and safe.
- **Test Gate**: All tests MUST pass. Coverage MUST NOT decrease for the modules changed
  in the PR.
- **Peer Review**: At least one peer review approval MUST be obtained before merge.
- **Constitution Check**: The PR author MUST explicitly confirm compliance with
  Principles I, II, and III in the PR description.

Complexity MUST be justified. Any new pattern, abstraction, or third-party dependency not
present in prior plans MUST include a written justification in the PR description.

## Development Workflow

Feature work MUST follow this sequence without exception:

1. **Spec** — A `spec.md` with Functional Requirements and acceptance scenarios MUST
   exist before a plan is created.
2. **Plan** — A `plan.md` with a completed Constitution Check and structure decision
   MUST exist before tasks are generated.
3. **Test First** — Tests MUST be written and confirmed failing before any implementation
   code is authored (see Principle II).
4. **Implement** — Code is written to make failing tests pass. No implementation without
   a prior failing test.
5. **Review** — Changes undergo peer review; the reviewer MUST verify Constitution Check
   compliance for all three Core Principles.
6. **Validate** — Quickstart validation (`quickstart.md`) MUST pass before the feature
   is marked complete.

Commits MUST be atomic and MUST reference the task ID
(e.g., `T014: implement UserStory-1 service layer`).

## Governance

This constitution supersedes all other development practices and guidelines within this
project. Amendments require:

- A documented rationale explaining the change and its necessity.
- A version increment following semantic versioning rules:
  - **MAJOR**: backward-incompatible governance change, principle removal or redefinition.
  - **MINOR**: new principle or section added, or materially expanded guidance.
  - **PATCH**: clarifications, wording refinements, typo corrections.
- Review and approval by at least one project maintainer before the amended version is
  committed to `main`.

All spec plans and task files MUST reference the active constitution version. Pull
requests that conflict with this constitution MUST NOT be merged until either the code is
corrected or a formal amendment has been ratified.

---

**Version**: 1.0.0 | **Ratified**: 2026-02-18 | **Last Amended**: 2026-02-18
