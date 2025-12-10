import fetch from 'node-fetch';

type CacheEntry<T> = { expires: number; value: T };

type LinearTeam = { id: string; name: string };
type LinearProject = { id: string; name: string; team: { name: string } | null };
type LinearState = { id: string; name: string; type: 'triage' | 'backlog' | 'started' | 'completed' | 'canceled' | string };
type LinearLabel = { name: string };
export type LinearIssue = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  state: LinearState | null;
  assignee: { id: string; name: string } | null;
  priority?: number | null;
  labels?: LinearLabel[] | null;
  team?: { name: string } | null;
  estimate?: number | null;
};

const LINEAR_URL = 'https://api.linear.app/graphql';
const CACHE_TTL_MS = 30 * 60 * 1000;

export class LinearClient {
  private token: string;
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(token: string) {
    this.token = token;
  }

  private setCache<T>(key: string, value: T) {
    this.cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) return entry.value as T;
    if (entry) this.cache.delete(key);
    return null;
  }

  private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(LINEAR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 401) {
      throw new Error('Linear authentication failed');
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Linear error: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      throw new Error(`Linear GraphQL error: ${json.errors[0].message}`);
    }
    if (!json.data) {
      throw new Error('Linear response missing data');
    }
    return json.data;
  }

  async validate(): Promise<boolean> {
    try {
      const data = await this.query<{ me: { id: string } }>('query { me { id } }');
      return Boolean(data.me?.id);
    } catch (err) {
      return false;
    }
  }

  async getProjects(): Promise<LinearProject[]> {
    const cached = this.getCache<LinearProject[]>('projects');
    if (cached) return cached;
    const data = await this.query<{
      projects: { nodes: { id: string; name: string; teams?: { nodes: { name: string }[] } }[] };
    }>('query { projects { nodes { id name teams { nodes { name } } } } }');
    const projects =
      data.projects?.nodes.map((p) => ({
        id: p.id,
        name: p.name,
        team: { name: p.teams?.nodes?.[0]?.name || 'Unknown team' },
      })) ?? [];
    this.setCache('projects', projects);
    return projects;
  }

  async getTeams(): Promise<LinearTeam[]> {
    const cached = this.getCache<LinearTeam[]>('teams');
    if (cached) return cached;
    const data = await this.query<{ teams: { nodes: LinearTeam[] } }>('query { teams { nodes { id name } } }');
    const teams = data.teams?.nodes ?? [];
    this.setCache('teams', teams);
    return teams;
  }

  async getIssues(teamId: string, first = 100, preferCache = false): Promise<LinearIssue[]> {
    const cacheKey = `issues:${teamId}`;
    const cached = this.getCache<LinearIssue[]>(cacheKey);
    if (cached || preferCache) return cached ?? [];

    let issues: LinearIssue[] = [];
    let hasNextPage = true;
    let after: string | null = null;

    const query = `query Issues($teamId: ID!, $first: Int!, $after: String) {
      issues(first: $first, after: $after, filter: { team: { id: { eq: $teamId } } }) {
        nodes {
          id
          title
          createdAt
          updatedAt
          completedAt
          state { id name type }
          assignee { id name }
          priority
          labels { nodes { name } }
          team { name }
          estimate
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    while (hasNextPage) {
      const data = await this.query<{
        issues: { nodes: LinearIssue[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
      }>(query, { teamId, first, after });

      const pageIssues = data.issues?.nodes ?? [];
      const normalized = pageIssues.map((issue) => ({
        ...issue,
        labels: (issue as any).labels?.nodes ?? [],
      }));
      issues = issues.concat(normalized);
      const pageInfo = data.issues?.pageInfo;
      hasNextPage = Boolean(pageInfo?.hasNextPage);
      after = pageInfo?.endCursor ?? null;
      if (!hasNextPage) break;
    }

    this.setCache(cacheKey, issues);
    return issues;
  }
}
