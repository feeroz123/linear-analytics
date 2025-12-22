import path from 'node:path';
import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import middie from '@fastify/middie';
import { config as loadEnv } from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { LinearClient } from './linear.js';
import { buildMetrics, filterIssues, Filters, inferIssueType, priorityLabel, severityLabel, weekLabel } from './metrics.js';
import { createSavedFilter, deleteSavedFilter, getAppState, listSavedFilters, saveAppState, saveTheme, updateSavedFilter } from './db.js';
import { generateChartSpec, ChartSpec } from './openai.js';
import { registerNoCacheHook } from './hooks.js';

loadEnv();

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);
let linearKey = process.env.LINEAR_API_KEY || '';
let openaiKey = process.env.OPENAI_API_KEY || '';

function getCreatedAtRange(filters: Filters | undefined) {
  if (!filters) return { createdAfter: undefined, createdBefore: undefined };
  if (filters.startDate || filters.endDate) {
    return {
      createdAfter: filters.startDate,
      createdBefore: filters.endDate,
    };
  }
  if (filters.time) {
    const days = filters.time === '7d' ? 7 : filters.time === '30d' ? 30 : 90;
    const createdAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return { createdAfter, createdBefore: undefined };
  }
  return { createdAfter: undefined, createdBefore: undefined };
}

// Disable etag/304s to keep responses always fresh for the SPA/API
const fastify = Fastify({ logger: true, etag: false });
await fastify.register(sensible);
await fastify.register(cors, { origin: true, credentials: true });
await fastify.register(middie);
await registerNoCacheHook(fastify);

let linearClient = linearKey ? new LinearClient(linearKey) : null;
const status = {
  linear: false,
  openai: Boolean(openaiKey),
};

if (linearClient) {
  status.linear = await linearClient.validate();
} else {
  fastify.log.warn('LINEAR_API_KEY not provided; API routes will fail.');
}

fastify.get('/api/health', async () => {
  const linearOk = linearClient ? await linearClient.validate() : false;
  status.linear = linearOk;
  return { linear: linearOk, openai: status.openai };
});

fastify.post('/api/reload-keys', async () => {
  loadEnv({ override: true });
  linearKey = process.env.LINEAR_API_KEY || '';
  openaiKey = process.env.OPENAI_API_KEY || '';
  linearClient = linearKey ? new LinearClient(linearKey) : null;
  status.openai = Boolean(openaiKey);
  status.linear = linearClient ? await linearClient.validate() : false;
  return { linear: status.linear, openai: status.openai };
});

fastify.get('/api/theme', async () => {
  const state = getAppState();
  return { theme: state.theme };
});

fastify.post('/api/theme', async (request, reply) => {
  const body = request.body as { theme?: string | null };
  if (!body.theme) return reply.badRequest('theme is required');
  saveTheme(body.theme);
  return { theme: body.theme };
});

fastify.get('/api/filter-presets', async () => {
  return { presets: listSavedFilters() };
});

fastify.post('/api/filter-presets', async (request, reply) => {
  const body = request.body as { name?: string; teamId?: string | null; filters?: Filters };
  if (!body.name || !body.filters) return reply.badRequest('name and filters are required');
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  createSavedFilter({ id, name: body.name, teamId: body.teamId ?? null, filters: body.filters });
  return { id };
});

fastify.put('/api/filter-presets/:id', async (request, reply) => {
  const body = request.body as { name?: string; teamId?: string | null; filters?: Filters };
  const id = (request.params as { id?: string }).id;
  if (!id || !body.name || !body.filters) return reply.badRequest('id, name, and filters are required');
  updateSavedFilter({ id, name: body.name, teamId: body.teamId ?? null, filters: body.filters });
  return { id };
});

fastify.delete('/api/filter-presets/:id', async (request, reply) => {
  const id = (request.params as { id?: string }).id;
  if (!id) return reply.badRequest('id is required');
  deleteSavedFilter(id);
  return { id };
});

fastify.get('/api/teams', async (request, reply) => {
  if (!linearClient) return reply.badRequest('Missing LINEAR_API_KEY');
  const teams = await linearClient.getTeams();
  status.linear = true;
  const state = getAppState();
  return { teams, lastTeam: state.lastProject, savedFilters: state.filters };
});

function parseFilters(params: Record<string, string | undefined>): Filters {
  const time = params.time as Filters['time'];
  const state = params.state;
  const type = params.type as Filters['type'];
  const assigneeId = params.assigneeId || undefined;
  const creatorId = params.creatorId || undefined;
  const cycleId = params.cycleId || undefined;
  const severity = params.severity || undefined;
  const priority = params.priority || undefined;
  const labels = params.labels ? params.labels.split(',').filter(Boolean) : undefined;
  const projectId = params.projectId || undefined;
  const startDate = params.startDate;
  const endDate = params.endDate;
  return {
    time: time === '7d' || time === '30d' || time === '90d' ? time : undefined,
    state: state || undefined,
    type: type === 'bug' || type === 'feature' || type === 'chore' || type === 'all' ? type : undefined,
    assigneeId,
    creatorId,
    cycleId,
    severity,
    priority,
    labels,
    projectId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };
}

fastify.get('/api/metrics', async (request, reply) => {
  if (!linearClient) return reply.badRequest('Missing LINEAR_API_KEY');
  const query = request.query as Record<string, string | undefined>;
  const teamId = query.teamId;
  if (!teamId) return reply.badRequest('teamId is required');

  const filters = parseFilters(query);
  const range = getCreatedAtRange(filters);
  const cachedIssues = await linearClient.getIssues(teamId, { first: 100, preferCache: true, ...range });
  const issues = cachedIssues.length ? cachedIssues : await linearClient.getIssues(teamId, { ...range });
  const metrics = buildMetrics(issues, filters);
  saveAppState(teamId, filters);

  const dates = issues.map((i) => i.createdAt).filter(Boolean).map((d) => new Date(d));
  const from = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : undefined;
  const to = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : undefined;

  return {
    metrics,
    filters,
    assignees: metrics.assignees,
    creators: metrics.creators,
    cycles: metrics.cycles,
    states: metrics.states,
    severities: metrics.severities,
    priorities: metrics.priorities,
    labels: metrics.labels,
    projects: metrics.projects,
    cacheInfo: { count: issues.length, from, to },
  };
});

fastify.post('/api/chart-from-prompt', async (request, reply) => {
  const body = request.body as { teamId?: string; filters?: Filters; prompt?: string };
  if (!linearClient) return reply.badRequest('Missing LINEAR_API_KEY');
  if (!openaiKey) return reply.badRequest('Missing OPENAI_API_KEY');
  if (!body.teamId || !body.prompt) return reply.badRequest('teamId and prompt are required');

  const range = getCreatedAtRange(body.filters);
  const cachedIssues = await linearClient.getIssues(body.teamId, { first: 100, preferCache: true, ...range });
  const issues = cachedIssues.length ? cachedIssues : await linearClient.getIssues(body.teamId, { ...range });
  const baseFilters = body.filters ?? {};
  const spec = await generateChartSpec(openaiKey, body.prompt);
  const data = buildChartFromSpec(issues, baseFilters, spec);

  return { spec, data };
});

function filterIssuesForChart(payload: {
  issues: any[];
  baseFilters: Filters;
  chart: 'throughput' | 'bugsByState' | 'bugsByAssignee' | 'bugsByPriority' | 'bugsBySeverity' | 'prompt';
  bucket?: string;
  series?: string;
  spec?: ChartSpec;
}) {
  const scoped = filterIssues(payload.issues, payload.baseFilters);
  switch (payload.chart) {
    case 'throughput': {
      const completed = scoped.filter((issue) => issue.completedAt);
      if (!payload.bucket) return completed;
      return completed.filter((issue) => weekLabel(new Date(issue.completedAt)) === payload.bucket);
    }
    case 'bugsByState': {
      const bugs = scoped.filter((issue) => inferIssueType(issue) === 'bug');
      if (!payload.bucket) return bugs;
      return bugs.filter((issue) => (issue.state?.type || 'unknown') === payload.bucket);
    }
    case 'bugsByAssignee': {
      const bugs = scoped.filter((issue) => inferIssueType(issue) === 'bug');
      if (!payload.bucket) return bugs;
      return bugs.filter((issue) => (issue.assignee?.name || 'Unassigned') === payload.bucket);
    }
    case 'bugsByPriority': {
      const bugs = scoped.filter((issue) => inferIssueType(issue) === 'bug');
      if (!payload.bucket) return bugs;
      return bugs.filter((issue) => priorityLabel(issue) === payload.bucket);
    }
    case 'bugsBySeverity': {
      const bugs = scoped.filter((issue) => inferIssueType(issue) === 'bug');
      if (!payload.bucket) return bugs;
      return bugs.filter((issue) => severityLabel(issue) === payload.bucket);
    }
    case 'prompt': {
      const spec = payload.spec;
      if (!spec) return [];
      const mergedFilters = applySpecFilter(payload.baseFilters, spec.filter);
      const promptScoped = filterIssues(payload.issues, mergedFilters);
      const grouped = spec.groupBy && spec.groupBy !== 'null';
      if (!payload.bucket) return promptScoped;
      return promptScoped.filter((issue) => {
        const bucket = bucketFromSpec(issue, spec.xAxis);
        if (bucket !== payload.bucket) return false;
        if (!grouped) return true;
        const groupKey = groupFromSpec(issue, spec.groupBy as any);
        return groupKey === payload.series;
      });
    }
    default:
      return scoped;
  }
}

function issuesToCsv(issues: any[]) {
  const headers = [
    'Issue ID',
    'Issue Title',
    'URL',
    'Created At',
    'Updated At',
    'Completed At',
    'State ID',
    'State Name',
    'State Type',
    'Type',
    'Creator ID',
    'Creator Name',
    'Assignee ID',
    'Assignee Name',
    'Priority',
    'Severity',
    'Labels',
    'Team',
    'Project ID',
    'Project Name',
    'Estimate',
    'Cycle ID',
    'Cycle Number',
    'Cycle Name',
  ];
  const escapeCsv = (value: string) => `"${value.replace(/\"/g, '""')}"`;
  const rows = issues.map((issue) => {
    const labels = (issue.labels ?? []).map((label: any) => label.name).join('; ');
    return [
      issue.identifier || issue.id,
      issue.title,
      issue.url,
      issue.createdAt,
      issue.updatedAt,
      issue.completedAt ?? '',
      issue.state?.id ?? '',
      issue.state?.name ?? '',
      issue.state?.type ?? '',
      inferIssueType(issue),
      issue.creator?.id ?? '',
      issue.creator?.name ?? '',
      issue.assignee?.id ?? '',
      issue.assignee?.name ?? '',
      priorityLabel(issue),
      severityLabel(issue),
      labels,
      issue.team?.name ?? '',
      issue.project?.id ?? '',
      issue.project?.name ?? '',
      issue.estimate?.toString() ?? '',
      issue.cycle?.id ?? '',
      issue.cycle?.number?.toString() ?? '',
      issue.cycle?.name ?? '',
    ].map((value) => escapeCsv(String(value)));
  });
  return [headers.map(escapeCsv).join(','), ...rows.map((row) => row.join(','))].join('\n');
}

fastify.get('/api/export', async (request, reply) => {
  if (!linearClient) return reply.badRequest('Missing LINEAR_API_KEY');
  const query = request.query as Record<string, string | undefined>;
  const teamId = query.teamId;
  if (!teamId) return reply.badRequest('teamId is required');

  const filters = parseFilters(query);
  const range = getCreatedAtRange(filters);
  const cachedIssues = await linearClient.getIssues(teamId, { first: 100, preferCache: true, ...range });
  const issues = cachedIssues.length ? cachedIssues : await linearClient.getIssues(teamId, { ...range });
  const scoped = filterIssues(issues, filters);

  const csv = issuesToCsv(scoped);
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', 'attachment; filename="linear-issues.csv"');
  return csv;
});

type IssueRow = {
  id: string;
  title: string;
  type: ReturnType<typeof inferIssueType>;
  creator: string;
  assignee: string;
  createdAt: string;
  status: string;
  severity: string;
  priority: string;
};

fastify.post('/api/issues-for-chart', async (request, reply) => {
  const body = request.body as {
    teamId?: string;
    filters?: Filters;
    chart?: 'throughput' | 'bugsByState' | 'bugsByAssignee' | 'bugsByPriority' | 'bugsBySeverity' | 'prompt';
    bucket?: string;
    series?: string;
    spec?: ChartSpec;
  };
  if (!linearClient) return reply.badRequest('Missing LINEAR_API_KEY');
  if (!body.teamId || !body.chart || !body.bucket) return reply.badRequest('teamId, chart, and bucket are required');

  const range = getCreatedAtRange(body.filters);
  const cachedIssues = await linearClient.getIssues(body.teamId, { first: 100, preferCache: true, ...range });
  const issues = cachedIssues.length ? cachedIssues : await linearClient.getIssues(body.teamId, { ...range });
  const baseFilters = body.filters ?? {};
  const filtered = filterIssuesForChart({
    issues,
    baseFilters,
    chart: body.chart,
    bucket: body.bucket,
    series: body.series,
    spec: body.spec,
  });
  const rows: IssueRow[] = filtered.map((issue) => ({
    id: issue.identifier || issue.id,
    title: issue.title,
    type: inferIssueType(issue),
    creator: issue.creator?.name || 'Unknown',
    assignee: issue.assignee?.name || 'Unassigned',
    createdAt: issue.createdAt,
    status: issue.state?.type || 'unknown',
    severity: severityLabel(issue),
    priority: priorityLabel(issue),
  }));

  return { issues: rows };
});

fastify.post('/api/export-chart', async (request, reply) => {
  const body = request.body as {
    teamId?: string;
    filters?: Filters;
    chart?: 'throughput' | 'bugsByState' | 'bugsByAssignee' | 'bugsByPriority' | 'bugsBySeverity' | 'prompt';
    bucket?: string;
    series?: string;
    spec?: ChartSpec;
  };
  if (!linearClient) return reply.badRequest('Missing LINEAR_API_KEY');
  if (!body.teamId || !body.chart) return reply.badRequest('teamId and chart are required');

  const range = getCreatedAtRange(body.filters);
  const cachedIssues = await linearClient.getIssues(body.teamId, { first: 100, preferCache: true, ...range });
  const issues = cachedIssues.length ? cachedIssues : await linearClient.getIssues(body.teamId, { ...range });
  const baseFilters = body.filters ?? {};
  const filtered = filterIssuesForChart({
    issues,
    baseFilters,
    chart: body.chart,
    bucket: body.bucket,
    series: body.series,
    spec: body.spec,
  });

  const csv = issuesToCsv(filtered);
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', 'attachment; filename=\"linear-issues-chart.csv\"');
  return csv;
});

function applySpecFilter(filters: Filters, filterString?: string): Filters {
  if (!filterString) return filters;
  const extra: Filters = { ...filters };
  filterString.split('&').forEach((pair) => {
    const [key, val] = pair.split('=');
    if (!key || !val) return;
    if (key === 'type' && (val === 'bug' || val === 'feature' || val === 'chore')) extra.type = val;
    if (key === 'state') extra.state = val;
    if (key === 'assignee') extra.assigneeId = val;
    if (key === 'creator') extra.creatorId = val;
    if (key === 'cycle') extra.cycleId = val;
    if (key === 'severity') extra.severity = val;
    if (key === 'priority') extra.priority = val;
    if (key === 'labels') extra.labels = val.split(',').filter(Boolean);
    if (key === 'projectId') extra.projectId = val;
  });
  return extra;
}

function bucketFromSpec(issue: any, axis: ChartSpec['xAxis']): string {
  switch (axis) {
    case 'week': {
      const date = new Date(issue.createdAt || issue.updatedAt || Date.now());
      const year = date.getUTCFullYear();
      const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / (1000 * 60 * 60 * 24) + 1) / 7);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    case 'priority':
      if (typeof issue.priority !== 'number') return 'No Priority';
      switch (issue.priority) {
        case 0:
          return 'Urgent';
        case 1:
          return 'High';
        case 2:
          return 'Medium';
        case 3:
          return 'Low';
        case 4:
          return 'No Priority';
        default:
          return `P${issue.priority}`;
      }
    case 'assignee':
      return issue.assignee?.name || 'Unassigned';
    case 'creator':
      return issue.creator?.name || 'Unknown';
    case 'stateType':
      return issue.state?.type || 'unknown';
    case 'severity': {
      const label = (issue.labels || []).find((l: any) => String(l.name).toLowerCase().includes('sev'))?.name;
      return label || 'Unknown';
    }
    case 'cycle':
      return issue.cycle?.name || (issue.cycle?.number ? `Cycle ${issue.cycle.number}` : 'No cycle');
    default:
      return 'Other';
  }
}

function groupFromSpec(issue: any, group: NonNullable<Exclude<ChartSpec['groupBy'], 'null'>>): string {
  switch (group) {
    case 'priority':
      if (typeof issue.priority !== 'number') return 'No Priority';
      switch (issue.priority) {
        case 0:
          return 'Urgent';
        case 1:
          return 'High';
        case 2:
          return 'Medium';
        case 3:
          return 'Low';
        case 4:
          return 'No Priority';
        default:
          return `P${issue.priority}`;
      }
    case 'team':
      return issue.team?.name || 'Unknown';
    case 'severity': {
      const label = (issue.labels || []).find((l: any) => String(l.name).toLowerCase().includes('sev'))?.name;
      return label || 'Unknown';
    }
    case 'creator':
      return issue.creator?.name || 'Unknown';
    case 'cycle':
      return issue.cycle?.name || (issue.cycle?.number ? `Cycle ${issue.cycle.number}` : 'No cycle');
    default:
      return 'Other';
  }
}

function buildChartFromSpec(issues: any[], filters: Filters, spec: ChartSpec) {
  const mergedFilters = applySpecFilter(filters, spec.filter);
  const filteredIssues = filterIssues(issues, mergedFilters);
  const grouped = spec.groupBy && spec.groupBy !== 'null';
  const map = new Map<string, { total: number; count: number; groups: Map<string, { total: number; count: number }> }>();

  filteredIssues.forEach((issue) => {
    const bucket = bucketFromSpec(issue, spec.xAxis);
    const value = spec.yAxis === 'count' ? 1 : issue.estimate ?? 0;
    const groupKey = grouped ? groupFromSpec(issue, spec.groupBy as any) : null;
    if (!map.has(bucket)) {
      map.set(bucket, { total: 0, count: 0, groups: new Map() });
    }
    const record = map.get(bucket)!;
    record.total += value;
    record.count += 1;

    if (grouped && groupKey) {
      if (!record.groups.has(groupKey)) record.groups.set(groupKey, { total: 0, count: 0 });
      const grp = record.groups.get(groupKey)!;
      grp.total += value;
      grp.count += 1;
    }
  });

  const formatValue = (total: number, count: number) => {
    if (spec.yAxis === 'count') return total;
    if (spec.yAxis === 'avgEstimate') return count === 0 ? 0 : Number((total / count).toFixed(2));
    return total;
  };

  if (spec.type === 'pie' || spec.type === 'donut') {
    return Array.from(map.entries()).map(([name, record]) => ({ name, value: formatValue(record.total, record.count) }));
  }

  const data = Array.from(map.entries()).map(([key, record]) => {
    if (!grouped) {
      const baseValue = formatValue(record.total, record.count);
      return spec.type === 'scatter' ? { x: key, y: baseValue } : { x: key, value: baseValue };
    }
    const obj: Record<string, any> = { x: key };
    record.groups.forEach((groupRecord, groupName) => {
      obj[groupName] = formatValue(groupRecord.total, groupRecord.count);
    });
    return obj;
  });

  return {
    xKey: 'x',
    grouped: grouped ? Array.from(new Set(data.flatMap((d) => Object.keys(d).filter((k) => k !== 'x')))) : [],
    data,
  };
}

if (!isProd) {
  const root = path.resolve(process.cwd(), 'src/client');
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa',
  });

  fastify.use((req, res, next) => {
    if (req.url && req.url.startsWith('/api')) return next();
    vite.middlewares(req, res, next);
  });

  fastify.get('/*', async (req, reply) => {
    const url = req.raw.url || '/';
    const indexPath = path.join(root, 'index.html');
    const template = await fs.promises.readFile(indexPath, 'utf-8');
    const transformed = await vite.transformIndexHtml(url, template);
    reply.type('text/html').send(transformed);
  });
} else {
  const distPath = path.resolve(process.cwd(), 'dist');
  fastify.get('/*', async (req, reply) => {
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) return reply.notFound();
    const html = await fs.promises.readFile(indexPath, 'utf-8');
    reply.type('text/html').send(html);
  });
}

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server running at ${address}`);
});
