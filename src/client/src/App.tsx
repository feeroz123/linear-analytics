import React from 'react';
import { Container, Loader, Center, Modal, Table, ScrollArea, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchTeams, fetchMetrics, Filters, generateChartFromPrompt, fetchIssuesForChart, IssueRow } from './api.js';
import Layout from './components/Layout.js';
import FiltersBar from './components/Filters.js';
import MetricsDashboard from './components/MetricsDashboard.js';
import PromptChart from './components/PromptChart.js';

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
    if (!teamId) return;
    setFilters((prev) => ({ ...prev, projectId: undefined }));
    setShouldFetch(true);
  }, [teamId]);

  React.useEffect(() => {
    if (filters.cycleId) setShouldFetch(true);
  }, [filters.cycleId]);

  const metricsQuery = useQuery({
    queryKey: ['metrics', teamId, filters, shouldFetch],
    queryFn: () => fetchMetrics(teamId!, filters),
    enabled: Boolean(teamId && shouldFetch),
    placeholderData: keepPreviousData,
  });

  const [promptResult, setPromptResult] = React.useState<{ spec: any; data: any } | null>(null);
  const [promptLoading, setPromptLoading] = React.useState(false);
  const [issuesModal, setIssuesModal] = React.useState<{ open: boolean; title: string; issues: IssueRow[] }>({
    open: false,
    title: '',
    issues: [],
  });
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

  const openIssuesModal = (title: string, issues: IssueRow[]) => setIssuesModal({ open: true, title, issues });
  const closeIssuesModal = () => setIssuesModal({ open: false, title: '', issues: [] });

  const handleChartClick = async (payload: {
    chart: 'throughput' | 'bugsByState' | 'bugsByAssignee' | 'bugsByPriority' | 'bugsBySeverity' | 'prompt';
    bucket: string;
    series?: string;
    spec?: any;
    title: string;
  }) => {
    if (!teamId) return;
    try {
      const result = await fetchIssuesForChart({
        teamId,
        filters,
        chart: payload.chart,
        bucket: payload.bucket,
        series: payload.series,
        spec: payload.spec,
      });
      openIssuesModal(payload.title, result.issues);
    } catch (err) {
      console.error(err);
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
              severities={metricsQuery.data?.severities || []}
              priorities={metricsQuery.data?.priorities || []}
              labels={metricsQuery.data?.labels || []}
              projects={metricsQuery.data?.projects || []}
              onRefresh={() => setShouldFetch(true)}
              loading={metricsQuery.isFetching}
              disabled={filtersDisabled}
              loadingMessage={
                filtersDisabled ? 'Refreshing data and cache… filters are temporarily disabled.' : undefined
              }
            />
            <MetricsDashboard
              metrics={metricsQuery.data?.metrics}
              loading={metricsQuery.isFetching}
              onChartClick={handleChartClick}
            />
            <PromptChart
              loading={promptLoading}
              onGenerate={handlePrompt}
              result={promptResult}
              disabled={!teamId}
              usingCache={true}
              onChartClick={(payload) =>
                handleChartClick({
                  chart: 'prompt',
                  bucket: payload.bucket,
                  series: payload.series,
                  spec: payload.spec,
                  title: payload.title,
                })
              }
            />
          </>
        )}
      </Container>
      <Modal opened={issuesModal.open} onClose={closeIssuesModal} title={issuesModal.title} size="xl" centered>
        {issuesModal.issues.length ? (
          <ScrollArea h={360}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Issue ID</Table.Th>
                  <Table.Th>Issue Title</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Creator</Table.Th>
                  <Table.Th>Assignee</Table.Th>
                  <Table.Th>Created On</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Severity</Table.Th>
                  <Table.Th>Priority</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {issuesModal.issues.map((issue) => (
                  <Table.Tr key={issue.id}>
                    <Table.Td>{issue.id}</Table.Td>
                    <Table.Td>{issue.title}</Table.Td>
                    <Table.Td>{issue.type}</Table.Td>
                    <Table.Td>{issue.creator}</Table.Td>
                    <Table.Td>{issue.assignee}</Table.Td>
                    <Table.Td>{new Date(issue.createdAt).toLocaleDateString()}</Table.Td>
                    <Table.Td>{issue.status}</Table.Td>
                    <Table.Td>{issue.severity}</Table.Td>
                    <Table.Td>{issue.priority}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <Text size="sm" c="dimmed">
            No issues found for this selection.
          </Text>
        )}
      </Modal>
    </Layout>
  );
}
