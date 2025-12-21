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

  const reference = new Date(issue.createdAt);
  if (start && reference < start) return false;
  if (end && reference > end) return false;
  return true;
}

function matchesState(issue: LinearIssue, state?: Filters['state']): boolean {
  if (!state || state === 'all') return true;
  const type = issue.state?.type;
  return type ? type === state : false;
}

function matchesAssignee(issue: LinearIssue, assigneeId?: string): boolean {
  if (!assigneeId) return true;
  if (!issue.assignee) return false;
  const needle = assigneeId.toLowerCase();
  return issue.assignee.id === assigneeId || issue.assignee.name.toLowerCase().includes(needle);
}

function matchesCreator(issue: LinearIssue, creatorId?: string): boolean {
  if (!creatorId) return true;
  if (!issue.creator) return false;
  const needle = creatorId.toLowerCase();
  return issue.creator.id === creatorId || issue.creator.name.toLowerCase().includes(needle);
}

function matchesCycle(issue: LinearIssue, cycleId?: string): boolean {
  if (!cycleId) return true;
  return issue.cycle?.id === cycleId;
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
      matchesCreator(issue, filters.creatorId) &&
      matchesCycle(issue, filters.cycleId) &&
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
  const counts = new Map<string, number>();
  issues.forEach((issue) => {
    const status = issue.state?.type || 'unknown';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

function collectCreators(issues: LinearIssue[]) {
  const map = new Map<string, string>();
  issues.forEach((issue) => {
    if (issue.creator) {
      map.set(issue.creator.id, issue.creator.name);
    }
  });
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

function collectCycles(issues: LinearIssue[]) {
  const map = new Map<string, { name: string; number: number }>();
  issues.forEach((issue) => {
    if (issue.cycle) {
      map.set(issue.cycle.id, { name: issue.cycle.name, number: issue.cycle.number });
    }
  });
  return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }));
}

function collectStates(issues: LinearIssue[]) {
  const set = new Set<string>();
  issues.forEach((issue) => {
    if (issue.state?.type) set.add(issue.state.type);
  });
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
}

export function buildMetrics(issues: LinearIssue[], filters: Filters) {
  const scopedIssues = filterIssues(issues, filters);
  return {
    throughput: computeThroughput(scopedIssues),
    openVsClosed: computeOpenVsClosed(scopedIssues),
    bugsByAssignee: computeBugsByAssignee(scopedIssues),
    bugsBySeverityPriority: computeSeverityPriority(scopedIssues),
    assignees: collectAssignees(issues),
    creators: collectCreators(issues),
    cycles: collectCycles(issues),
    states: collectStates(issues),
  };
}
