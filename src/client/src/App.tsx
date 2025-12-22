import React from 'react';
import { Container, Loader, Center, Modal, Table, ScrollArea, Text, useMantineColorScheme, Stack } from '@mantine/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  createFilterPreset,
  deleteFilterPreset,
  fetchFilterPresets,
  fetchHealth,
  fetchIssuesForChart,
  fetchMetrics,
  fetchTeams,
  Filters,
  generateChartFromPrompt,
  IssueRow,
  exportIssuesCsv,
  exportChartCsv,
  fetchTheme,
  reloadApiKeys,
  saveTheme,
  updateFilterPreset,
} from './api.js';
import Layout from './components/Layout.js';
import FiltersBar from './components/Filters.js';
import MetricsDashboard from './components/MetricsDashboard.js';
import PromptChart from './components/PromptChart.js';

const defaultFilters: Filters = { time: '7d' };

export default function App() {
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = React.useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const presetsQuery = useQuery({ queryKey: ['filter-presets'], queryFn: fetchFilterPresets });
  const themeQuery = useQuery({
    queryKey: ['theme'],
    queryFn: fetchTheme,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const appliedTheme = React.useRef(false);

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
    if (appliedTheme.current) return;
    if (themeQuery.data?.theme) {
      setColorScheme(themeQuery.data.theme === 'dark' ? 'dark' : 'light');
      appliedTheme.current = true;
    }
  }, [setColorScheme, themeQuery.data?.theme]);

  React.useEffect(() => {
    if (!teamId) return;
    setFilters((prev) => ({ ...prev, projectId: undefined }));
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

  const handleExport = async () => {
    if (!teamId) return;
    try {
      const blob = await exportIssuesCsv(teamId, filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `linear-issues-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPdf = async () => {
    if (!exportRef.current) return;
    try {
      const now = new Date();
      const exportedAt = now.toLocaleString();
      const selectedTeam = teams.find((team) => team.id === teamId)?.name || 'Unknown team';
      const selectedProject = metricsQuery.data?.projects?.find((p) => p.id === filters.projectId)?.name;
      const selectedAssignee = metricsQuery.data?.assignees?.find((a) => a.id === filters.assigneeId)?.name;
      const selectedCreator = metricsQuery.data?.creators?.find((c) => c.id === filters.creatorId)?.name;
      const selectedCycle = metricsQuery.data?.cycles?.find((c) => c.id === filters.cycleId)?.name;
      const filtersSummary = [
        `Team: ${selectedTeam}`,
        `Project: ${selectedProject || 'Any'}`,
        `Time: ${filters.time || 'Any'}`,
        `Start: ${filters.startDate ? new Date(filters.startDate).toLocaleDateString() : 'Any'}`,
        `End: ${filters.endDate ? new Date(filters.endDate).toLocaleDateString() : 'Any'}`,
        `State: ${filters.state || 'Any'}`,
        `Type: ${filters.type || 'All'}`,
        `Assignee: ${selectedAssignee || 'Any'}`,
        `Creator: ${selectedCreator || 'Any'}`,
        `Cycle: ${selectedCycle || 'Any'}`,
        `Severity: ${filters.severity || 'Any'}`,
        `Priority: ${filters.priority || 'Any'}`,
        `Labels: ${filters.labels?.length ? filters.labels.join('; ') : 'Any'}`,
      ].join(' | ');

      const renderToCanvas = html2canvas as unknown as (
        element: HTMLElement,
        options?: Record<string, unknown>,
      ) => Promise<HTMLCanvasElement>;
      const canvas = await renderToCanvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY,
      });
      const imgData = canvas.toDataURL('image/png');
      const margin = 32;
      const headerHeight = 56;
      const pdfWidth = canvas.width;
      const pdfHeight = canvas.height + headerHeight + margin;
      const pdf = new jsPDF('p', 'pt', [pdfWidth, pdfHeight]);
      pdf.setFontSize(12);
      pdf.text(`Exported: ${exportedAt}`, margin, 24);
      pdf.setFontSize(10);
      pdf.text(filtersSummary, margin, 42, { maxWidth: pdfWidth - margin * 2 });
      pdf.addImage(imgData, 'PNG', 0, headerHeight, pdfWidth, canvas.height);
      const date = now.toISOString().slice(0, 10);
      pdf.save(`linear-dashboard-${date}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTheme = () => {
    const next = colorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(next);
    saveTheme(next).catch((err) => console.error(err));
    themeQuery.refetch().catch(() => undefined);
  };

  const handleReloadKeys = () => {
    reloadApiKeys()
      .then(() => {
        healthQuery.refetch();
        teamsQuery.refetch();
      })
      .catch((err) => console.error(err));
  };

  const handleSavePreset = () => {
    const name = window.prompt('Save filters as:');
    if (!name) return;
    createFilterPreset({ name, teamId, filters })
      .then(() => presetsQuery.refetch())
      .catch((err) => console.error(err));
  };

  const handleSelectPreset = (id: string) => {
    const preset = presetsQuery.data?.presets.find((item) => item.id === id);
    if (!preset) return;
    if (preset.teamId) setTeamId(preset.teamId);
    setFilters(preset.filters);
    setSelectedPresetId(id);
    setShouldFetch(true);
  };

  const handleEditPreset = (id?: string) => {
    if (!id) return;
    const preset = presetsQuery.data?.presets.find((item) => item.id === id);
    if (!preset) return;
    const name = window.prompt('Rename filters as:', preset.name);
    if (!name || name === preset.name) return;
    updateFilterPreset({ id, name, teamId: preset.teamId, filters: preset.filters })
      .then(() => presetsQuery.refetch())
      .catch((err) => console.error(err));
  };

  const handleDeletePreset = (id?: string) => {
    if (!id) return;
    const preset = presetsQuery.data?.presets.find((item) => item.id === id);
    const ok = window.confirm(`Delete saved filters "${preset?.name || 'this preset'}"?`);
    if (!ok) return;
    deleteFilterPreset(id)
      .then(() => {
        presetsQuery.refetch();
        if (selectedPresetId === id) setSelectedPresetId(null);
      })
      .catch((err) => console.error(err));
  };

  const handleExportChart = async (payload: {
    chart: 'throughput' | 'bugsByState' | 'bugsByAssignee' | 'bugsByPriority' | 'bugsBySeverity' | 'prompt';
    bucket?: string;
    series?: string;
    spec?: any;
    title: string;
  }) => {
    if (!teamId) return;
    try {
      const blob = await exportChartCsv({
        teamId,
        filters,
        chart: payload.chart,
        bucket: payload.bucket,
        series: payload.series,
        spec: payload.spec,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      const safeTitle = payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      link.href = url;
      link.download = `linear-${safeTitle || 'chart'}-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
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
  const openaiHealthy = Boolean(healthQuery.data?.openai);
  const filtersDisabled = teamsQuery.isFetching || metricsQuery.isFetching;
  const showPreloader = metricsQuery.isFetching && shouldFetch;
  const lastRefreshed = metricsQuery.dataUpdatedAt ? new Date(metricsQuery.dataUpdatedAt) : null;
  const cacheInfo = metricsQuery.data?.cacheInfo;

  return (
    <div ref={exportRef}>
      <Layout
        linearOk={linearHealthy}
        openaiOk={Boolean(healthQuery.data?.openai)}
        lastRefreshed={lastRefreshed}
        cacheInfo={cacheInfo}
        onToggleTheme={handleToggleTheme}
        onReloadKeys={handleReloadKeys}
      >
      <Container size="xl" py="md">
        {teamsQuery.isLoading || showPreloader ? (
          <Center h="60vh">
            <Stack align="center" gap="sm">
              <Loader />
              <Text size="sm" c="dimmed" fw={700}>
                Refreshing caches.... Please wait.
              </Text>
            </Stack>
          </Center>
        ) : (
          <>
            <FiltersBar
              teams={teams}
              savedPresets={(presetsQuery.data?.presets || []).map(({ id, name }) => ({ id, name }))}
              filters={filters}
              onChangeFilters={setFilters}
              teamId={teamId}
              onSelectTeam={setTeamId}
              onSelectPreset={handleSelectPreset}
              onSavePreset={handleSavePreset}
              onEditPreset={handleEditPreset}
              onDeletePreset={handleDeletePreset}
              selectedPresetId={selectedPresetId}
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
              onExportCsv={handleExport}
              onExportPdf={handleExportPdf}
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
              onChartExport={(payload) =>
                handleExportChart({
                  chart: payload.chart,
                  title: payload.title,
                })
              }
              linearHealthy={linearHealthy}
            />
            <PromptChart
              loading={promptLoading}
              onGenerate={handlePrompt}
              result={promptResult}
              disabled={!teamId || !openaiHealthy}
              usingCache={true}
              openaiHealthy={openaiHealthy}
              onChartClick={(payload) =>
                handleChartClick({
                  chart: 'prompt',
                  bucket: payload.bucket,
                  series: payload.series,
                  spec: payload.spec,
                  title: payload.title,
                })
              }
              onChartExport={(payload) =>
                handleExportChart({
                  chart: 'prompt',
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
    </div>
  );
}
