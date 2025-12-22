export type Filters = {
  time?: '7d' | '30d' | '90d';
  state?: string;
  type?: 'all' | 'bug' | 'feature' | 'chore';
  assigneeId?: string;
  creatorId?: string;
  cycleId?: string;
  severity?: string;
  priority?: string;
  labels?: string[];
  projectId?: string;
  startDate?: string;
  endDate?: string;
};

export type Team = { id: string; name: string };

export type MetricsResponse = {
  metrics: {
    throughput: { week: string; count: number }[];
    openVsClosed: { name: string; value: number }[];
    bugsByAssignee: { name: string; count: number }[];
    bugsBySeverity: { name: string; count: number }[];
    bugsBySeverityPriority: { severity: string; priority: string; count: number }[];
    assignees: { id: string; name: string }[];
    creators: { id: string; name: string }[];
    cycles: { id: string; name: string; number: number }[];
    states: string[];
    severities: string[];
    priorities: string[];
    labels: string[];
    projects: { id: string; name: string }[];
  };
  filters: Filters;
  assignees: { id: string; name: string }[];
  creators: { id: string; name: string }[];
  cycles: { id: string; name: string; number: number }[];
  states: string[];
  severities: string[];
  priorities: string[];
  labels: string[];
  projects: { id: string; name: string }[];
  cacheInfo?: { count: number; from?: string; to?: string };
};

export type ChartDataResponse = {
  spec: {
    type: 'bar' | 'line' | 'pie' | 'donut' | 'scatter';
    title: string;
    xAxis: string;
    yAxis: string;
    groupBy?: string | null;
    filter?: string;
  };
  data: any;
};

export type SavedFilterPreset = {
  id: string;
  name: string;
  teamId: string | null;
  filters: Filters;
  createdAt: string;
};

export type IssueRow = {
  id: string;
  title: string;
  type: 'bug' | 'feature' | 'chore' | 'other';
  creator: string;
  assignee: string;
  createdAt: string;
  status: string;
  severity: string;
  priority: string;
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
}

const noStore: RequestInit = { cache: 'no-store' };

export async function fetchHealth() {
  const res = await fetch('/api/health', noStore);
  return handle<{ linear: boolean; openai: boolean }>(res);
}

export async function reloadApiKeys() {
  const res = await fetch('/api/reload-keys', {
    method: 'POST',
    cache: 'no-store',
  });
  return handle<{ linear: boolean; openai: boolean }>(res);
}

export async function fetchTeams() {
  const res = await fetch('/api/teams', noStore);
  return handle<{ teams: Team[]; lastTeam: string | null; savedFilters: Filters | null }>(res);
}

function buildFilterParams(teamId: string, filters: Filters) {
  const params = new URLSearchParams({ teamId });
  (Object.entries(filters) as [keyof Filters, any][]).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
      return;
    }
    if (value) params.set(key, value);
  });
  return params;
}

export async function fetchMetrics(teamId: string, filters: Filters) {
  const params = buildFilterParams(teamId, filters);
  const res = await fetch(`/api/metrics?${params.toString()}`, noStore);
  return handle<MetricsResponse>(res);
}

export async function generateChartFromPrompt(teamId: string, filters: Filters, prompt: string) {
  const res = await fetch('/api/chart-from-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ teamId, filters, prompt }),
  });
  return handle<ChartDataResponse>(res);
}

export async function fetchIssuesForChart(payload: {
  teamId: string;
  filters: Filters;
  chart: 'throughput' | 'bugsByState' | 'bugsByAssignee' | 'bugsByPriority' | 'bugsBySeverity' | 'prompt';
  bucket: string;
  series?: string;
  spec?: ChartDataResponse['spec'];
}) {
  const res = await fetch('/api/issues-for-chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  return handle<{ issues: IssueRow[] }>(res);
}

export async function exportIssuesCsv(teamId: string, filters: Filters) {
  const params = buildFilterParams(teamId, filters);
  const res = await fetch(`/api/export?${params.toString()}`, noStore);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.blob();
}

export async function exportChartCsv(payload: {
  teamId: string;
  filters: Filters;
  chart: 'throughput' | 'bugsByState' | 'bugsByAssignee' | 'bugsByPriority' | 'bugsBySeverity' | 'prompt';
  bucket?: string;
  series?: string;
  spec?: ChartDataResponse['spec'];
}) {
  const res = await fetch('/api/export-chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.blob();
}

export async function fetchFilterPresets() {
  const res = await fetch('/api/filter-presets', { cache: 'no-store' });
  return handle<{ presets: SavedFilterPreset[] }>(res);
}

export async function createFilterPreset(payload: { name: string; teamId: string | null; filters: Filters }) {
  const res = await fetch('/api/filter-presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  return handle<{ id: string }>(res);
}

export async function fetchTheme() {
  const res = await fetch('/api/theme', { cache: 'no-store' });
  return handle<{ theme: string | null }>(res);
}

export async function saveTheme(theme: string) {
  const res = await fetch('/api/theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ theme }),
  });
  return handle<{ theme: string }>(res);
}

export async function updateFilterPreset(payload: { id: string; name: string; teamId: string | null; filters: Filters }) {
  const res = await fetch(`/api/filter-presets/${payload.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  return handle<{ id: string }>(res);
}

export async function deleteFilterPreset(id: string) {
  const res = await fetch(`/api/filter-presets/${id}`, {
    method: 'DELETE',
    cache: 'no-store',
  });
  return handle<{ id: string }>(res);
}
