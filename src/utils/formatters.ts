import { CaseStatus, CasePriority, CaseState } from '@/types';

// ── Date formatter ────────────────────────────────────────────────────────

/**
 * Formats an ISO 8601 date string to a locale-aware date string.
 * Example: "2026-02-15T09:45:00Z" → "Feb 15, 2026"
 */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── CaseStatus label ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<CaseStatus, string> = {
  [CaseStatus.InProgress]: 'In Progress',
  [CaseStatus.OnHold]: 'On Hold',
  [CaseStatus.WaitingForDetails]: 'Waiting for Details',
  [CaseStatus.Researching]: 'Researching',
  [CaseStatus.ProblemSolved]: 'Problem Solved',
  [CaseStatus.Cancelled]: 'Cancelled',
};

export function formatCaseStatusLabel(status: CaseStatus): string {
  return STATUS_LABELS[status] ?? String(status);
}

// ── CasePriority label ────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<CasePriority, string> = {
  [CasePriority.High]: 'High',
  [CasePriority.Normal]: 'Normal',
  [CasePriority.Low]: 'Low',
};

export function formatCasePriorityLabel(priority: CasePriority): string {
  return PRIORITY_LABELS[priority] ?? String(priority);
}

// ── CaseState label ───────────────────────────────────────────────────────

const STATE_LABELS: Record<CaseState, string> = {
  [CaseState.Active]: 'Active',
  [CaseState.Resolved]: 'Resolved',
  [CaseState.Cancelled]: 'Cancelled',
};

export function formatCaseStateLabel(state: CaseState): string {
  return STATE_LABELS[state] ?? String(state);
}
