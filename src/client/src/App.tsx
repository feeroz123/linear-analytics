import React from 'react';
import { Container, Loader, Center } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchProjects, fetchMetrics, Filters, generateChartFromPrompt } from './api';
import Layout from './components/Layout';
import FiltersBar from './components/Filters';
import MetricsDashboard from './components/MetricsDashboard';
import PromptChart from './components/PromptChart';

const defaultFilters: Filters = { time: '30d', state: 'all', type: 'all' };

export default function App() {
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);

  const healthQuery = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects, staleTime: 5 * 60 * 1000 });

  React.useEffect(() => {
    if (projectsQuery.data && !projectId) {
      const saved = projectsQuery.data.lastProject;
      if (saved) setProjectId(saved);
      else if (projectsQuery.data.projects.length) setProjectId(projectsQuery.data.projects[0].id);
      if (projectsQuery.data.savedFilters) setFilters({ ...defaultFilters, ...projectsQuery.data.savedFilters });
    }
  }, [projectsQuery.data, projectId]);

  const metricsQuery = useQuery({
    queryKey: ['metrics', projectId, filters],
    queryFn: () => fetchMetrics(projectId!, filters),
    enabled: Boolean(projectId),
    keepPreviousData: true,
  });

  const [promptResult, setPromptResult] = React.useState<{ spec: any; data: any } | null>(null);
  const [promptLoading, setPromptLoading] = React.useState(false);
  const handlePrompt = async (prompt: string) => {
    if (!projectId) return;
    setPromptLoading(true);
    try {
      const result = await generateChartFromPrompt(projectId, filters, prompt);
      setPromptResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setPromptLoading(false);
    }
  };

  const projects = projectsQuery.data?.projects || [];

  const linearHealthy = Boolean(healthQuery.data?.linear || projectsQuery.isSuccess);

  return (
    <Layout linearOk={linearHealthy} openaiOk={Boolean(healthQuery.data?.openai)}>
      <Container size="xl" py="md">
        {projectsQuery.isLoading ? (
          <Center h="60vh">
            <Loader />
          </Center>
        ) : (
          <>
            <FiltersBar
              projects={projects}
              filters={filters}
              onChangeFilters={setFilters}
              projectId={projectId}
              onSelectProject={setProjectId}
              assignees={metricsQuery.data?.assignees || []}
              onRefresh={() => metricsQuery.refetch()}
              loading={metricsQuery.isFetching}
            />
            <MetricsDashboard metrics={metricsQuery.data?.metrics} loading={metricsQuery.isFetching} />
            <PromptChart
              loading={promptLoading}
              onGenerate={handlePrompt}
              result={promptResult}
              disabled={!projectId}
            />
          </>
        )}
      </Container>
    </Layout>
  );
}
