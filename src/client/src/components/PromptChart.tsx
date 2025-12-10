import React from 'react';
import { Card, Textarea, Button, Stack, Text, Group } from '@mantine/core';
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
} from 'recharts';

const palette = ['#1f78ff', '#4dabf7', '#f59f00', '#ff6b6b', '#15aabf', '#845ef7'];

type Props = {
  loading?: boolean;
  onGenerate: (prompt: string) => void;
  result: { spec: any; data: any } | null;
  disabled?: boolean;
  usingCache?: boolean;
};

export default function PromptChart({ loading, onGenerate, result, disabled, usingCache }: Props) {
  const [prompt, setPrompt] = React.useState('Show bugs by assignee last 30 days');

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
            <Text fw={700}>Prompt → Chart</Text>
          </Group>
          {usingCache && (
            <Text
              size="sm"
              style={{ color: '#0b3d91', fontWeight: 700, fontStyle: 'italic' }}
            >
              Chart is based on cached issues. Click Refresh to fetch the latest data before generating.
            </Text>
          )}
          <Textarea
            label="Describe your chart"
            value={prompt}
            onChange={(e) => setPrompt(e.currentTarget.value)}
            minRows={2}
          />
          <Button type="submit" loading={loading} disabled={disabled} size="sm" radius="md" w="fit-content">
            Generate Chart
          </Button>
          {empty ? (
            <Text
              c="dimmed"
              size="sm"
              style={{ color: '#0b3d91', fontWeight: 700, fontStyle: 'italic' }}
            >
              Generate a chart to see results.
            </Text>
          ) : (
            <DynamicChart spec={result!.spec} data={result!.data} />
          )}
        </Stack>
      </form>
    </Card>
  );
}

function DynamicChart({ spec, data }: { spec: any; data: any }) {
  if (!data) return null;

  const renderPie = () => (
    <ResponsiveContainer height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
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
              <Bar key={key} dataKey={key} name={key} fill={palette[idx % palette.length]} radius={4} />
            ))}
          </BarChart>
        ) : (
          <LineChart data={rows}>
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
      <ScatterChart>
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
