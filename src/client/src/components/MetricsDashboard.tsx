import React from 'react';
import {
  Card,
  Grid,
  Text,
  Skeleton,
  Stack,
  ActionIcon,
  Modal,
  Group,
  useMantineTheme,
  useComputedColorScheme,
} from '@mantine/core';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from 'recharts';
import { IconMaximize, IconInfoCircle } from '@tabler/icons-react';
import { Tooltip as MantineTooltip } from '@mantine/core';

type Metrics = {
  throughput: { week: string; count: number }[];
  openVsClosed: { name: string; value: number }[];
  bugsByAssignee: { name: string; count: number }[];
  bugsBySeverity: { name: string; count: number }[];
  bugsBySeverityPriority: { severity: string; priority: string; count: number }[];
};

type Props = {
  metrics?: Metrics;
  loading?: boolean;
};

const skeleton = <Skeleton height={160} radius="md" />;

function EmptyState() {
  return (
    <div
      style={{
        height: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0b3d91',
        fontWeight: 700,
        fontStyle: 'italic',
      }}
    >
      No data yet. Select a team or adjust filters.
    </div>
  );
}

export default function MetricsDashboard({ metrics, loading }: Props) {
  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme('light');
  const palette =
    colorScheme === 'dark'
      ? ['#6ab0ff', '#8dd2ff', '#ffb86b', '#ff8787', '#74c0fc', '#c8b5ff']
      : ['#1f78ff', '#4dabf7', '#f59f00', '#ff6b6b', '#15aabf', '#845ef7'];
  const [modal, setModal] = React.useState<{ open: boolean; title: string; content: React.ReactNode }>({
    open: false,
    title: '',
    content: null,
  });

  const openModal = (title: string, content: React.ReactNode) => setModal({ open: true, title, content });
  const closeModal = () => setModal({ open: false, title: '', content: null });
  const formatTotal = (value: number) => value.toLocaleString();
  const throughputTotal = metrics ? metrics.throughput.reduce((sum, row) => sum + row.count, 0) : 0;
  const openClosedTotal = metrics ? metrics.openVsClosed.reduce((sum, row) => sum + row.value, 0) : 0;
  const bugsAssigneeTotal = metrics ? metrics.bugsByAssignee.reduce((sum, row) => sum + row.count, 0) : 0;
  const bugsSeverityOnlyTotal = metrics ? metrics.bugsBySeverity.reduce((sum, row) => sum + row.count, 0) : 0;
  const bugsSeverityTotal = metrics ? metrics.bugsBySeverityPriority.reduce((sum, row) => sum + row.count, 0) : 0;

  return (
    <Stack mb="md">
      <Text fw={700} size="lg">
        Default Metrics
      </Text>
      <Stack gap="md">
        <ChartCard
          title={`Throughput (All Tickets: Weekly distribution) ${metrics ? `· ${formatTotal(throughputTotal)}` : ''}`}
          tooltip="Completed Tickets grouped by week based on completedAt."
          loading={loading}
          onExpand={
            metrics && metrics.throughput.length
              ? () =>
                  openModal(
                    'Throughput (All Tickets: Weekly distribution)',
                    <BarChartFull data={metrics.throughput} color={palette[0]} height={360} />,
                  )
              : undefined
          }
        >
          {loading ? skeleton : metrics && metrics.throughput.length ? <BarChartFull data={metrics.throughput} color={palette[0]} height={240} /> : <EmptyState />}
        </ChartCard>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <ChartCard
              title={`Bugs by State ${metrics ? `· ${formatTotal(openClosedTotal)}` : ''}`}
              tooltip="Distribution of bug issues by Linear state type."
              loading={loading}
              onExpand={
                metrics && metrics.openVsClosed.length
                  ? () => openModal('Bugs by State', <PieChartFull data={metrics.openVsClosed} palette={palette} height={320} />)
                  : undefined
              }
            >
              {loading ? skeleton : metrics && metrics.openVsClosed.length ? (
                <PieChartFull data={metrics.openVsClosed} palette={palette} height={200} shrink={0.5} />
              ) : (
                <EmptyState />
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8 }}>
            <ChartCard
              title={`Bugs / Assignee ${metrics ? `· ${formatTotal(bugsAssigneeTotal)}` : ''}`}
              tooltip="Count of bug-type issues per assignee."
              loading={loading}
              onExpand={
                metrics && metrics.bugsByAssignee.length
                  ? () => openModal('Bugs / Assignee', <BarAssignee data={metrics.bugsByAssignee} color={palette[2]} height={320} />)
                  : undefined
              }
            >
              {loading ? skeleton : metrics && metrics.bugsByAssignee.length ? <BarAssignee data={metrics.bugsByAssignee} color={palette[2]} height={200} /> : <EmptyState />}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <ChartCard
              title={`Bugs by Priority ${metrics ? `· ${formatTotal(bugsSeverityTotal)}` : ''}`}
              tooltip="Bug counts grouped by priority."
              loading={loading}
              onExpand={
                metrics && metrics.bugsBySeverityPriority.length
                  ? () =>
                      openModal(
                        'Bugs by Priority',
                        <BarSeverity data={metrics.bugsBySeverityPriority} palette={palette} height={320} />,
                      )
                  : undefined
              }
            >
              {loading ? skeleton : metrics && metrics.bugsBySeverityPriority.length ? (
                <BarSeverity data={metrics.bugsBySeverityPriority} palette={palette} height={200} />
              ) : (
                <EmptyState />
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <ChartCard
              title={`Bugs by Severity ${metrics ? `· ${formatTotal(bugsSeverityOnlyTotal)}` : ''}`}
              tooltip="Bug counts grouped by severity."
              loading={loading}
              onExpand={
                metrics && metrics.bugsBySeverity.length
                  ? () =>
                      openModal(
                        'Bugs by Severity',
                        <BarCategory data={metrics.bugsBySeverity} color={palette[3]} height={320} />,
                      )
                  : undefined
              }
            >
              {loading ? skeleton : metrics && metrics.bugsBySeverity.length ? (
                <BarCategory data={metrics.bugsBySeverity} color={palette[3]} height={200} />
              ) : (
                <EmptyState />
              )}
            </ChartCard>
          </Grid.Col>
        </Grid>
      </Stack>

      <Modal opened={modal.open} onClose={closeModal} title={modal.title} size="xl" centered>
        {modal.content}
      </Modal>
    </Stack>
  );
}

function ChartCard({
  title,
  loading,
  onExpand,
  children,
  tooltip,
}: {
  title: string;
  loading?: boolean;
  onExpand?: () => void;
  children: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <Card withBorder shadow="sm" padding="sm" radius="md">
      <Group justify="space-between" align="center" mb="xs">
        <Group gap="xs" align="center">
          <Text size="sm" fw={600}>
            {title}
          </Text>
          {tooltip && (
            <MantineTooltip label={tooltip} withArrow>
              <ActionIcon variant="subtle" size="sm" aria-label="Chart info">
                <IconInfoCircle size={16} />
              </ActionIcon>
            </MantineTooltip>
          )}
        </Group>
        <ActionIcon variant="subtle" size="sm" onClick={onExpand} disabled={!onExpand} aria-label="Expand chart">
          <IconMaximize size={16} />
        </ActionIcon>
      </Group>
      {children}
    </Card>
  );
}

function BarChartFull({
  data,
  color,
  height,
}: {
  data: { week: string; count: number }[];
  color: string;
  height: number;
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ bottom: 28, left: 12, right: 8 }}>
          <XAxis dataKey="week" angle={-20} textAnchor="end" height={60} tickMargin={10} interval={0} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill={color} radius={4}>
            <LabelList dataKey="count" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieChartFull({
  data,
  palette,
  height,
  shrink,
}: {
  data: { name: string; value: number }[];
  palette: string[];
  height: number;
  shrink?: number;
}) {
  const factor = shrink ?? 0.9;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie dataKey="value" data={data} outerRadius={Math.min(120, height / 2) * factor} label>
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: 8 }}
          />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarAssignee({
  data,
  color,
  height,
}: {
  data: { name: string; count: number }[];
  color: string;
  height: number;
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 20, bottom: 12 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis dataKey="name" type="category" width={100} tickMargin={8} />
          <Tooltip />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: 4 }}
          />
          <Bar dataKey="count" fill={color} radius={4}>
            <LabelList dataKey="count" position="right" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarCategory({
  data,
  color,
  height,
}: {
  data: { name: string; count: number }[];
  color: string;
  height: number;
}) {
  const severityColors: Record<string, string> = {
    Critical: '#e03131',
    Major: '#f08c00',
    Minor: '#fab005',
    Trivial: '#2f9e44',
    Unknown: color,
  };
  const legendPayload = data.map((row) => ({
    value: row.name,
    color: severityColors[row.name] || color,
    type: 'square' as const,
  }));
  const legendTitle = 'Severity';
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ bottom: 16 }}>
          <XAxis dataKey="name" tickMargin={6} />
          <YAxis allowDecimals={false} label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            payload={legendPayload}
            content={(props) => <LegendWithLabel label={legendTitle} {...props} />}
            wrapperStyle={{ paddingTop: 4 }}
          />
          <Bar dataKey="count" name="Count" radius={4}>
            {data.map((row) => (
              <Cell key={row.name} fill={severityColors[row.name] || color} />
            ))}
            <LabelList dataKey="count" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarSeverity({
  data,
  palette,
  height,
}: {
  data: { severity: string; priority: string; count: number }[];
  palette: string[];
  height: number;
}) {
  const grouped = data.reduce<Record<string, { priority: string; count: number }>>((acc, row) => {
    if (!acc[row.priority]) acc[row.priority] = { priority: row.priority, count: 0 };
    acc[row.priority].count += row.count;
    return acc;
  }, {});
  const chartData = Object.values(grouped);
  const priorityColors: Record<string, string> = {
    Urgent: palette[2],
    High: palette[3],
    Medium: palette[1],
    Low: palette[0],
    'No Priority': palette[4],
  };
  const legendPayload = chartData.map((row) => ({
    value: row.priority,
    color: priorityColors[row.priority] || palette[5] || palette[0],
    type: 'square' as const,
  }));
  const legendTitle = 'Priority';
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ bottom: 24 }}>
          <XAxis dataKey="priority" tickMargin={6} />
          <YAxis allowDecimals={false} label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            payload={legendPayload}
            content={(props) => <LegendWithLabel label={legendTitle} {...props} />}
            wrapperStyle={{ paddingTop: 8 }}
          />
          <Bar dataKey="count" name="Count" radius={4}>
            {chartData.map((row) => (
              <Cell key={row.priority} fill={priorityColors[row.priority] || palette[5] || palette[0]} />
            ))}
            <LabelList dataKey="count" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendWithLabel({
  label,
  payload,
}: {
  label: string;
  payload?: { value: string; color: string }[];
}) {
  if (!payload || payload.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {payload.map((entry) => (
        <span key={entry.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              backgroundColor: entry.color,
              borderRadius: 2,
            }}
          />
          <span>{entry.value}</span>
        </span>
      ))}
    </div>
  );
}
