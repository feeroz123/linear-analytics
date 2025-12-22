import React from 'react';
import { Card, Textarea, Button, Stack, Text, Group, ActionIcon, Tooltip as MantineTooltip } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  Legend,
  LabelList,
} from 'recharts';

const palette = ['#1f78ff', '#4dabf7', '#f59f00', '#ff6b6b', '#15aabf', '#845ef7'];

type Props = {
  loading?: boolean;
  onGenerate: (prompt: string) => void;
  result: { spec: any; data: any } | null;
  disabled?: boolean;
  usingCache?: boolean;
  onChartClick?: (payload: { bucket: string; series?: string; spec: any; title: string }) => void;
  onChartExport?: (payload: { spec: any; title: string }) => void;
  openaiHealthy?: boolean;
};

export default function PromptChart({
  loading,
  onGenerate,
  result,
  disabled,
  usingCache,
  onChartClick,
  onChartExport,
  openaiHealthy = true,
}: Props) {
  const [prompt, setPrompt] = React.useState('Show bugs by assignee last 30 days');
  const total = result ? computeChartTotal(result.spec, result.data) : null;
  const totalLabel = total !== null ? `· ${total.toLocaleString()}` : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(prompt);
  };

  const empty = !result;

  return (
    <Card withBorder shadow="sm" radius="md">
      <form onSubmit={handleSubmit}>
        <Stack>
          <Group justify="space-between">
            <Text fw={700}>Prompt → Chart {totalLabel}</Text>
            <MantineTooltip label="Export chart" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label="Export chart"
                onClick={() =>
                  result &&
                  onChartExport?.({
                    spec: result.spec,
                    title: result.spec?.title || 'Prompt Chart',
                  })
                }
                disabled={!result}
              >
                <IconDownload size={16} />
              </ActionIcon>
            </MantineTooltip>
          </Group>
          {usingCache && (
            <Text
              size="sm"
              style={{ color: '#0b3d91', fontWeight: 700, fontStyle: 'italic' }}
            >
              Chart is based on cached issues. Click Refresh to fetch the latest data before generating.
            </Text>
          )}
          {!openaiHealthy && (
            <Text size="sm" c="red">
              OpenAI API key is missing or invalid. Prompt chart is disabled.
            </Text>
          )}
          <Textarea
            label="Describe your chart"
            value={prompt}
            onChange={(e) => setPrompt(e.currentTarget.value)}
            minRows={2}
          />
          <MantineTooltip label="Generate chart from prompt" withArrow>
            <Button type="submit" loading={loading} disabled={disabled} size="sm" radius="md" w="fit-content" color="blue">
              Generate Chart
            </Button>
          </MantineTooltip>
          {empty ? (
            <Text
              c="dimmed"
              size="sm"
              style={{ color: '#0b3d91', fontWeight: 700, fontStyle: 'italic' }}
            >
              Generate a chart to see results.
            </Text>
          ) : (
            <DynamicChart
              spec={result!.spec}
              data={result!.data}
              onChartClick={(bucket, series) =>
                onChartClick?.({
                  bucket,
                  series,
                  spec: result!.spec,
                  title: `${result!.spec?.title || 'Prompt Chart'} · ${bucket}${series ? ` · ${series}` : ''}`,
                })
              }
            />
          )}
        </Stack>
      </form>
    </Card>
  );
}

function computeChartTotal(spec: any, data: any): number | null {
  if (!data || !spec) return null;

  if (spec.type === 'pie' || spec.type === 'donut') {
    if (!Array.isArray(data)) return null;
    return data.reduce((sum: number, row: { value?: number }) => sum + (Number(row.value) || 0), 0);
  }

  if (spec.type === 'scatter') {
    const rows = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
    return rows.reduce((sum: number, row: { y?: number }) => sum + (Number(row.y) || 0), 0);
  }

  const rows = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
  if (!rows.length) return 0;

  const groupedKeys = Array.isArray(data.grouped) && data.grouped.length ? data.grouped : null;
  if (groupedKeys) {
    return rows.reduce((sum, row) => {
      const rowTotal = groupedKeys.reduce(
        (rowSum: number, key: string) => rowSum + (Number((row as Record<string, unknown>)[key]) || 0),
        0,
      );
      return sum + rowTotal;
    }, 0 as number);
  }

  return rows.reduce((sum: number, row: { value?: number }) => sum + (Number(row.value) || 0), 0);
}

function DynamicChart({
  spec,
  data,
  onChartClick,
}: {
  spec: any;
  data: any;
  onChartClick?: (bucket: string, series?: string) => void;
}) {
  if (!data) return null;

  const renderPie = () => (
    <ResponsiveContainer height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={100}
          label
          onClick={(entry) => onChartClick?.(entry?.name)}
        >
          {data.map((_: any, idx: number) => (
            <Cell key={idx} fill={palette[idx % palette.length]} />
          ))}
        </Pie>
        <Legend />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );

  const renderBarOrLine = (type: 'bar' | 'line') => {
    const seriesKeys: string[] = Array.isArray(data.grouped) && data.grouped.length > 0 ? data.grouped : ['value'];
    const rows = Array.isArray(data.data) ? data.data : data;
    return (
      <ResponsiveContainer height={300}>
        {type === 'bar' ? (
          <BarChart data={rows}>
            <XAxis dataKey="x" />
            <YAxis />
            <Tooltip />
            <Legend />
            {seriesKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                name={key}
                fill={palette[idx % palette.length]}
                radius={4}
                onClick={(entry) => onChartClick?.(entry?.payload?.x, key === 'value' ? undefined : key)}
              >
                <LabelList dataKey={key} position="top" />
              </Bar>
            ))}
          </BarChart>
        ) : (
          <LineChart
            data={rows}
            onClick={(state) => {
              const payload = state?.activePayload?.[0]?.payload;
              if (payload?.x) onChartClick?.(payload.x);
            }}
          >
            <XAxis dataKey="x" />
            <YAxis />
            <Tooltip />
            <Legend />
            {seriesKeys.map((key, idx) => (
              <Line key={key} type="monotone" dataKey={key} stroke={palette[idx % palette.length]} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    );
  };

  const renderScatter = () => (
    <ResponsiveContainer height={300}>
      <ScatterChart
        onClick={(state) => {
          const payload = state?.activePayload?.[0]?.payload;
          if (payload?.x) onChartClick?.(payload.x);
        }}
      >
        <XAxis dataKey="x" />
        <YAxis dataKey="y" />
        <Tooltip />
        <Scatter data={Array.isArray(data) ? data : data.data} fill={palette[0]} />
      </ScatterChart>
    </ResponsiveContainer>
  );

  switch (spec?.type) {
    case 'pie':
    case 'donut':
      return renderPie();
    case 'line':
      return renderBarOrLine('line');
    case 'scatter':
      return renderScatter();
    default:
      return renderBarOrLine('bar');
  }
}
