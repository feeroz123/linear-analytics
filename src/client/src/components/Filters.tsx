import React from 'react';
import { Card, Grid, Select, Button, Group, Text, MultiSelect } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconRefresh } from '@tabler/icons-react';
import { Filters, Team } from '../api.js';

type Props = {
  teams: Team[];
  filters: Filters;
  onChangeFilters: (f: Filters) => void;
  teamId: string | null;
  onSelectTeam: (id: string) => void;
  assignees: { id: string; name: string }[];
  creators: { id: string; name: string }[];
  cycles: { id: string; name: string; number: number }[];
  states: string[];
  severities: string[];
  priorities: string[];
  labels: string[];
  onRefresh: () => void;
  onClearFilters: () => void;
  loading?: boolean;
  disabled?: boolean;
  loadingMessage?: string;
};

export default function FiltersBar({
  teams,
  filters,
  onChangeFilters,
  teamId,
  onSelectTeam,
  assignees,
  creators,
  cycles,
  states,
  severities,
  priorities,
  labels,
  onRefresh,
  onClearFilters,
  loading,
  disabled,
  loadingMessage,
}: Props) {
  const timeDisabled = disabled || Boolean(filters.startDate || filters.endDate) || Boolean(filters.cycleId);
  const dateDisabled = disabled || Boolean(filters.time) || Boolean(filters.cycleId);
  const cycleDisabled = disabled || Boolean(filters.time || filters.startDate || filters.endDate);
  const prevDateDisabled = React.useRef(dateDisabled);

  React.useEffect(() => {
    if (prevDateDisabled.current && !dateDisabled && !filters.endDate) {
      onChangeFilters({ ...filters, endDate: new Date().toISOString() });
    }
    prevDateDisabled.current = dateDisabled;
  }, [dateDisabled, filters, onChangeFilters]);

  return (
    <Card withBorder shadow="sm" mb="md" radius="md">
      <Grid gutter="sm" align="end">
        <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
          <Select
            label="Team"
            data={teams.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Select team"
            value={teamId}
            onChange={(val) => val && onSelectTeam(val)}
            searchable
            radius="md"
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="Time"
            data={[
              { value: '', label: 'Any' },
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
            ]}
            value={filters.time || ''}
            onChange={(val) =>
              onChangeFilters({
                ...filters,
                time: val ? (val as Filters['time']) : undefined,
                startDate: undefined,
                endDate: undefined,
                cycleId: undefined,
              })
            }
            radius="md"
            disabled={timeDisabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="State"
            data={[{ value: '', label: 'Any' }, ...states.map((state) => ({ value: state, label: state }))]}
            value={filters.state || ''}
            onChange={(val) => onChangeFilters({ ...filters, state: val || undefined })}
            radius="md"
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="Type"
            data={[
              { value: 'all', label: 'All' },
              { value: 'bug', label: 'Bug' },
              { value: 'feature', label: 'Feature' },
              { value: 'chore', label: 'Chore' },
            ]}
            value={filters.type || 'all'}
            onChange={(val) => onChangeFilters({ ...filters, type: val as Filters['type'] })}
            radius="md"
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="Severity"
            data={[{ value: '', label: 'Any' }, ...severities.map((sev) => ({ value: sev, label: sev }))]}
            value={filters.severity || ''}
            onChange={(val) => onChangeFilters({ ...filters, severity: val || undefined })}
            searchable
            radius="md"
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="Priority"
            data={[{ value: '', label: 'Any' }, ...priorities.map((p) => ({ value: p, label: p }))]}
            value={filters.priority || ''}
            onChange={(val) => onChangeFilters({ ...filters, priority: val || undefined })}
            searchable
            radius="md"
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <MultiSelect
            label="Labels"
            data={labels.map((label) => ({ value: label, label }))}
            value={filters.labels || []}
            onChange={(values) => onChangeFilters({ ...filters, labels: values })}
            searchable
            clearable
            radius="md"
            disabled={disabled}
            placeholder="Select labels"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="Assignee"
            data={[{ value: '', label: 'Any' }, ...assignees.map((a) => ({ value: a.id, label: a.name }))]}
            value={filters.assigneeId || ''}
            onChange={(val) => onChangeFilters({ ...filters, assigneeId: val || undefined })}
            searchable
            radius="md"
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="Creator"
            data={[{ value: '', label: 'Any' }, ...creators.map((c) => ({ value: c.id, label: c.name }))]}
            value={filters.creatorId || ''}
            onChange={(val) => onChangeFilters({ ...filters, creatorId: val || undefined })}
            searchable
            radius="md"
            disabled={disabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="Cycle"
            data={[
              { value: '', label: 'Any' },
              ...cycles.map((cycle) => ({
                value: cycle.id,
                label: cycle.name || `Cycle ${cycle.number}`,
              })),
            ]}
            value={filters.cycleId || ''}
            onChange={(val) =>
              onChangeFilters({
                ...filters,
                cycleId: val || undefined,
                time: val ? undefined : filters.time,
                startDate: val ? undefined : filters.startDate,
                endDate: val ? undefined : filters.endDate,
              })
            }
            searchable
            radius="md"
            disabled={cycleDisabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <DateInput
            label="Start Date"
            value={filters.startDate ? new Date(filters.startDate) : null}
            onChange={(date) =>
              onChangeFilters({
                ...filters,
                startDate: date ? date.toISOString() : undefined,
                time: undefined,
                cycleId: undefined,
              })
            }
            clearable
            radius="md"
            disabled={dateDisabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <DateInput
            label="End Date"
            value={filters.endDate ? new Date(filters.endDate) : null}
            onChange={(date) =>
              onChangeFilters({
                ...filters,
                endDate: date ? date.toISOString() : undefined,
                time: undefined,
                cycleId: undefined,
              })
            }
            clearable
            radius="md"
            disabled={dateDisabled}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 8, md: 4 }}>
          <Group align="end" justify="flex-end" h="100%" gap="xs">
            <Button
              variant="subtle"
              onClick={onClearFilters}
              radius="md"
              size="sm"
              disabled={disabled}
            >
              Clear Filters
            </Button>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={onRefresh}
              loading={loading}
              radius="md"
              size="sm"
              disabled={disabled}
            >
              Refresh
            </Button>
          </Group>
        </Grid.Col>
        {loadingMessage && (
          <Grid.Col span={12}>
            <Text
              size="sm"
              style={{ color: '#0b3d91', fontWeight: 700, fontStyle: 'italic' }}
            >
              {loadingMessage}
            </Text>
          </Grid.Col>
        )}
      </Grid>
    </Card>
  );
}
