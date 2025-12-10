import { Card, Grid, Select, Button, Group } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconRefresh } from '@tabler/icons-react';
import { Filters, Project } from '../api';

type Props = {
  projects: Project[];
  filters: Filters;
  onChangeFilters: (f: Filters) => void;
  projectId: string | null;
  onSelectProject: (id: string) => void;
  assignees: { id: string; name: string }[];
  onRefresh: () => void;
  loading?: boolean;
};

export default function FiltersBar({
  projects,
  filters,
  onChangeFilters,
  projectId,
  onSelectProject,
  assignees,
  onRefresh,
  loading,
}: Props) {
  return (
    <Card withBorder shadow="sm" mb="md" radius="md">
      <Grid gutter="sm" align="end">
        <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
          <Select
            label="Team"
            data={projects.map((p) => ({ value: p.id, label: `${p.name} (${p.team.name})` }))}
            placeholder="Select team"
            value={projectId}
            onChange={(val) => val && onSelectProject(val)}
            searchable
            radius="md"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="Time"
            data={[
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
            ]}
            value={filters.time}
            onChange={(val) => onChangeFilters({ ...filters, time: val as Filters['time'] })}
            radius="md"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <Select
            label="State"
            data={[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'completed', label: 'Completed' },
            ]}
            value={filters.state || 'all'}
            onChange={(val) => onChangeFilters({ ...filters, state: val as Filters['state'] })}
            radius="md"
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
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <DateInput
            label="Start Date"
            value={filters.startDate ? new Date(filters.startDate) : null}
            onChange={(date) =>
              onChangeFilters({ ...filters, startDate: date ? date.toISOString() : undefined })
            }
            clearable
            radius="md"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
          <DateInput
            label="End Date"
            value={filters.endDate ? new Date(filters.endDate) : null}
            onChange={(date) => onChangeFilters({ ...filters, endDate: date ? date.toISOString() : undefined })}
            clearable
            radius="md"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4, md: 2 }}>
          <Group align="end" justify="flex-end" h="100%">
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={onRefresh}
              loading={loading}
              radius="md"
              size="sm"
            >
              Refresh
            </Button>
          </Group>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
