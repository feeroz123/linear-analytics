import { LinearIssue } from './linear.js';
import { SavedFilters } from './db.js';

export type Filters = SavedFilters;

const DAY_MS = 24 * 60 * 60 * 1000;

function getWindowStart(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

export function inferIssueType(issue: LinearIssue): 'bug' | 'feature' | 'chore' | 'other' {
  const labelNames = (issue.labels ?? []).map((l) => l.name.toLowerCase());
  if (labelNames.some((l) => l.includes('bug'))) return 'bug';
  if (labelNames.some((l) => l.includes('feature'))) return 'feature';
  if (labelNames.some((l) => l.includes('chore'))) return 'chore';
  return 'other';
}

function withinTime(issue: LinearIssue, filters: Filters): boolean {
  let start: Date | null = null;
  let end: Date | null = null;

  if (filters.time) {
    start =
      filters.time === '7d'
        ? getWindowStart(7)
        : filters.time === '30d'
          ? getWindowStart(30)
          : getWindowStart(90);
  }

  if (filters.startDate) start = new Date(filters.startDate);
  if (filters.endDate) end = new Date(filters.endDate);

  const timestamps = [issue.createdAt, issue.updatedAt, issue.completedAt].filter(Boolean).map((t) => new Date(t!));
  return timestamps.some((t) => {
    if (start && t < start) return false;
    if (end && t > end) return false;
    return true;
  });
}

function matchesState(issue: LinearIssue, state?: Filters['state']): boolean {
  if (!state || state === 'all') return true;
  const type = issue.state?.type || (issue.completedAt ? 'completed' : 'open');
  if (state === 'open') return type !== 'completed';
  if (state === 'completed') return type === 'completed';
  return true;
}

function matchesAssignee(issue: LinearIssue, assigneeId?: string): boolean {
  if (!assigneeId) return true;
  return issue.assignee?.id === assigneeId;
}

function matchesType(issue: LinearIssue, type?: Filters['type']): boolean {
  if (!type || type === 'all') return true;
  return inferIssueType(issue) === type;
}

export function filterIssues(issues: LinearIssue[], filters: Filters): LinearIssue[] {
  return issues.filter(
    (issue) =>
      withinTime(issue, filters) &&
      matchesState(issue, filters.state) &&
      matchesAssignee(issue, filters.assigneeId) &&
      matchesType(issue, filters.type),
  );
}

function weekLabel(date: Date) {
  const year = date.getUTCFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

function computeThroughput(issues: LinearIssue[]) {
  const counts = new Map<string, number>();
  issues
    .filter((i) => i.completedAt)
    .forEach((issue) => {
      const label = weekLabel(new Date(issue.completedAt!));
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
  return Array.from(counts.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function computeOpenVsClosed(issues: LinearIssue[]) {
  let open = 0;
  let closed = 0;
  issues.forEach((issue) => {
    const status = issue.state?.type || (issue.completedAt ? 'completed' : 'open');
    if (status === 'completed') closed += 1;
    else open += 1;
  });
  return [
    { name: 'Open', value: open },
    { name: 'Closed', value: closed },
  ];
}

function computeBugsByAssignee(issues: LinearIssue[]) {
  const counts = new Map<string, number>();
  issues
    .filter((i) => inferIssueType(i) === 'bug')
    .forEach((issue) => {
      const name = issue.assignee?.name || 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
}

function computeSeverityPriority(issues: LinearIssue[]) {
  const rows: { severity: string; priority: string; count: number }[] = [];
  const pushRow = (severity: string, priority: string) => {
    const existing = rows.find((r) => r.severity === severity && r.priority === priority);
    if (existing) existing.count += 1;
    else rows.push({ severity, priority, count: 1 });
  };

  issues
    .filter((i) => inferIssueType(i) === 'bug')
    .forEach((issue) => {
      const severityLabel = (issue.labels ?? []).find((l) => l.name.toLowerCase().includes('sev'))?.name || 'Unknown';
      const priorityValue = typeof issue.priority === 'number' ? `P${issue.priority}` : 'Unprioritized';
      pushRow(severityLabel, priorityValue);
    });

  return rows;
}

function collectAssignees(issues: LinearIssue[]) {
  const map = new Map<string, string>();
  issues.forEach((issue) => {
    if (issue.assignee) {
      map.set(issue.assignee.id, issue.assignee.name);
    }
  });
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

export function buildMetrics(issues: LinearIssue[], filters: Filters) {
  const scopedIssues = filterIssues(issues, filters);
  return {
    throughput: computeThroughput(scopedIssues),
    openVsClosed: computeOpenVsClosed(scopedIssues),
    bugsByAssignee: computeBugsByAssignee(scopedIssues),
    bugsBySeverityPriority: computeSeverityPriority(scopedIssues),
    assignees: collectAssignees(issues),
  };
}
