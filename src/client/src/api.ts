export type Filters = {
  time?: '7d' | '30d' | '90d';
  state?: 'all' | 'open' | 'completed';
  type?: 'all' | 'bug' | 'feature' | 'chore';
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
};

export type Team = { id: string; name: string };

export type MetricsResponse = {
  metrics: {
    throughput: { week: string; count: number }[];
    openVsClosed: { name: string; value: number }[];
    bugsByAssignee: { name: string; count: number }[];
    bugsBySeverityPriority: { severity: string; priority: string; count: number }[];
    assignees: { id: string; name: string }[];
  };
  filters: Filters;
  assignees: { id: string; name: string }[];
  cacheInfo?: { count: number; from?: string; to?: string };
};

export type ChartDataResponse = {
  spec: {
    type: 'bar' | 'line' | 'pie' | 'donut' | 'scatter';
    title: string;
    xAxis: string;
    yAxis: string;
    groupBy?: string | null;
  };
  data: any;
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

export async function fetchTeams() {
  const res = await fetch('/api/teams', noStore);
  return handle<{ teams: Team[]; lastTeam: string | null; savedFilters: Filters | null }>(res);
}

export async function fetchMetrics(teamId: string, filters: Filters) {
  const params = new URLSearchParams({ teamId });
  (Object.entries(filters) as [keyof Filters, any][]).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
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
