import React from 'react';
import { Container, Loader, Center } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchTeams, fetchMetrics, Filters, generateChartFromPrompt } from './api';
import Layout from './components/Layout';
import FiltersBar from './components/Filters';
import MetricsDashboard from './components/MetricsDashboard';
import PromptChart from './components/PromptChart';

const defaultFilters: Filters = { time: '7d' };

export default function App() {
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);
  const [shouldFetch, setShouldFetch] = React.useState(false);

  const healthQuery = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: fetchTeams, staleTime: 5 * 60 * 1000 });

  React.useEffect(() => {
    if (teamsQuery.data && !teamId) {
      const saved = teamsQuery.data.lastTeam;
      if (saved) setTeamId(saved);
      else if (teamsQuery.data.teams.length) setTeamId(teamsQuery.data.teams[0].id);
      setFilters(defaultFilters);
    }
  }, [teamsQuery.data, teamId]);

  React.useEffect(() => {
    if (filters.cycleId) setShouldFetch(true);
  }, [filters.cycleId]);

  const metricsQuery = useQuery({
    queryKey: ['metrics', teamId, filters, shouldFetch],
    queryFn: () => fetchMetrics(teamId!, filters),
    enabled: Boolean(teamId && shouldFetch),
    keepPreviousData: true,
  });

  const [promptResult, setPromptResult] = React.useState<{ spec: any; data: any } | null>(null);
  const [promptLoading, setPromptLoading] = React.useState(false);
  const handlePrompt = async (prompt: string) => {
    if (!teamId) return;
    setPromptLoading(true);
    try {
      const result = await generateChartFromPrompt(teamId, filters, prompt);
      setPromptResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setPromptLoading(false);
    }
  };

  const teams = teamsQuery.data?.teams || [];

  const linearHealthy = Boolean(healthQuery.data?.linear || teamsQuery.isSuccess);
  const filtersDisabled = teamsQuery.isFetching || metricsQuery.isFetching;
  const lastRefreshed = metricsQuery.dataUpdatedAt ? new Date(metricsQuery.dataUpdatedAt) : null;
  const cacheInfo = metricsQuery.data?.cacheInfo;

  return (
    <Layout
      linearOk={linearHealthy}
      openaiOk={Boolean(healthQuery.data?.openai)}
      lastRefreshed={lastRefreshed}
      cacheInfo={cacheInfo}
    >
      <Container size="xl" py="md">
        {teamsQuery.isLoading ? (
          <Center h="60vh">
            <Loader />
          </Center>
        ) : (
          <>
            <FiltersBar
              teams={teams}
              filters={filters}
              onChangeFilters={setFilters}
              teamId={teamId}
              onSelectTeam={setTeamId}
              onClearFilters={() => setFilters(defaultFilters)}
              assignees={metricsQuery.data?.assignees || []}
              creators={metricsQuery.data?.creators || []}
              cycles={metricsQuery.data?.cycles || []}
              states={metricsQuery.data?.states || []}
              onRefresh={() => setShouldFetch(true)}
              loading={metricsQuery.isFetching}
              disabled={filtersDisabled}
              loadingMessage={
                filtersDisabled ? 'Refreshing data and cache… filters are temporarily disabled.' : undefined
              }
            />
            <MetricsDashboard metrics={metricsQuery.data?.metrics} loading={metricsQuery.isFetching} />
            <PromptChart
              loading={promptLoading}
              onGenerate={handlePrompt}
              result={promptResult}
              disabled={!teamId}
              usingCache={true}
            />
          </>
        )}
      </Container>
    </Layout>
  );
}
