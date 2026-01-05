import React from 'react';
import { Card, Grid, Select, Button, Group, Text, MultiSelect, Menu, Tooltip, ActionIcon, Collapse } from '@mantine/core';
import { IconTrash, IconEdit, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { IconDownload, IconRefresh } from '@tabler/icons-react';
import { Filters, Team } from '../api.js';

type Props = {
  teams: Team[];
  savedPresets: { id: string; name: string }[];
  filters: Filters;
  onChangeFilters: (f: Filters) => void;
  teamId: string | null;
  onSelectTeam: (id: string) => void;
  onSelectPreset: (id: string) => void;
  onSavePreset: () => void;
  onEditPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  selectedPresetId?: string | null;
  assignees: { id: string; name: string }[];
  creators: { id: string; name: string }[];
  cycles: { id: string; name: string; number: number }[];
  states: string[];
  severities: string[];
  priorities: string[];
  labels: string[];
  projects: { id: string; name: string }[];
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onClearFilters: () => void;
  loading?: boolean;
  disabled?: boolean;
  loadingMessage?: string;
};

export default function FiltersBar({
  teams,
  savedPresets,
  filters,
  onChangeFilters,
  teamId,
  onSelectTeam,
  onSelectPreset,
  onSavePreset,
  onEditPreset,
  onDeletePreset,
  selectedPresetId,
  assignees,
  creators,
  cycles,
  states,
  severities,
  priorities,
  labels,
  projects,
  onRefresh,
  onExportCsv,
  onExportPdf,
  onClearFilters,
  loading,
  disabled,
  loadingMessage,
}: Props) {
  const [opened, setOpened] = React.useState(() => {
    const stored = localStorage.getItem('linear-filters-open');
    return stored ? stored === 'true' : false;
  });
  const timeDisabled = disabled || Boolean(filters.startDate || filters.endDate) || Boolean(filters.cycleId);
  const dateDisabled = disabled || Boolean(filters.time) || Boolean(filters.cycleId);
  const cycleDisabled = disabled || Boolean(filters.time || filters.startDate || filters.endDate);
  const prevDateDisabled = React.useRef(dateDisabled);
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const sortedPresets = [...savedPresets].sort((a, b) => a.name.localeCompare(b.name));
  const appliedBorder = (active: boolean) =>
    active
      ? {
          input: {
            borderColor: '#228be6',
            boxShadow: '0 0 0 1px #228be6',
          },
        }
      : undefined;

  React.useEffect(() => {
    if (prevDateDisabled.current && !dateDisabled && !filters.endDate) {
      onChangeFilters({ ...filters, endDate: new Date().toISOString() });
    }
    prevDateDisabled.current = dateDisabled;
  }, [dateDisabled, filters, onChangeFilters]);

  return (
    <Card withBorder shadow="sm" mb="md" radius="md">
      <Group justify="space-between" align="center" mb="xs">
        <Text fw={700} size="sm">
          Filters
        </Text>
        <Tooltip label={opened ? 'Collapse filters' : 'Expand filters'} withArrow>
          <ActionIcon
            variant="subtle"
            onClick={() => {
              setOpened((prev) => {
                const next = !prev;
                localStorage.setItem('linear-filters-open', String(next));
                return next;
              });
            }}
            aria-label="Toggle filters"
          >
            {opened ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
          </ActionIcon>
        </Tooltip>
      </Group>
      <Collapse in={opened}>
        <Grid gutter="sm" align="end">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Select
            label="Team"
            data={[{ value: '', label: 'None' }, ...sortedTeams.map((t) => ({ value: t.id, label: t.name }))]}
            placeholder="Select team"
            value={teamId || ''}
            onChange={(val) => onSelectTeam(val || '')}
            searchable
            radius="md"
            disabled={disabled}
            styles={appliedBorder(Boolean(teamId))}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Select
            label="Project"
            data={[{ value: '', label: 'Any' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            value={filters.projectId || ''}
            onChange={(val) => onChangeFilters({ ...filters, projectId: val || undefined })}
            searchable
            radius="md"
            disabled={disabled}
            styles={appliedBorder(Boolean(filters.projectId))}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Group gap="xs" align="end">
            <Select
            label="Saved Filters"
            data={[
              { value: '', label: 'None' },
              ...sortedPresets.map((preset) => ({ value: preset.id, label: preset.name })),
            ]}
              placeholder="Select saved filters"
              value={selectedPresetId || ''}
              onChange={(val) => (val ? onSelectPreset(val) : onSelectPreset(''))}
              searchable
              radius="md"
              disabled={disabled}
              styles={{ root: { flex: 1 }, ...appliedBorder(Boolean(selectedPresetId)) }}
            />
            <Tooltip label="Rename saved filters" withArrow>
              <ActionIcon
                variant="light"
                aria-label="Rename saved filters"
                onClick={() => selectedPresetId && onEditPreset(selectedPresetId)}
                disabled={disabled || !selectedPresetId}
              >
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete saved filters" withArrow>
              <ActionIcon
                variant="light"
                aria-label="Delete saved filters"
                onClick={() => selectedPresetId && onDeletePreset(selectedPresetId)}
                disabled={disabled || !selectedPresetId}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
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
            styles={appliedBorder(Boolean(filters.time))}
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
            styles={appliedBorder(Boolean(filters.state))}
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
            styles={appliedBorder(Boolean(filters.type && filters.type !== 'all'))}
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
            styles={appliedBorder(Boolean(filters.severity))}
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
            styles={appliedBorder(Boolean(filters.priority))}
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
            styles={appliedBorder(Boolean(filters.labels && filters.labels.length))}
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
            styles={appliedBorder(Boolean(filters.assigneeId))}
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
            styles={appliedBorder(Boolean(filters.creatorId))}
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
            styles={appliedBorder(Boolean(filters.cycleId))}
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
            styles={appliedBorder(Boolean(filters.startDate))}
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
            styles={appliedBorder(Boolean(filters.endDate))}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          <Group align="end" justify="flex-end" h="100%" gap="xs" wrap="nowrap">
            <Tooltip label="Clear all filters" withArrow>
              <Button
                variant="filled"
                onClick={onClearFilters}
                radius="md"
                size="sm"
                color="blue"
                disabled={disabled}
              >
                Clear Filters
              </Button>
            </Tooltip>
            <Tooltip label="Save current filters" withArrow>
              <Button variant="filled" onClick={onSavePreset} radius="md" size="sm" color="blue" disabled={disabled}>
                Save Filters
              </Button>
            </Tooltip>
            <Tooltip label="Refresh data" withArrow>
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="filled"
                onClick={onRefresh}
                loading={loading}
                radius="md"
                size="sm"
                color="blue"
                disabled={disabled}
              >
                Refresh
              </Button>
            </Tooltip>
            <Menu shadow="md" width={180} position="bottom-end">
              <Menu.Target>
                <Tooltip label="Export data" withArrow>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    variant="filled"
                    radius="md"
                    size="sm"
                    color="blue"
                    disabled={disabled}
                  >
                    Export
                  </Button>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={onExportCsv}>CSV</Menu.Item>
                <Menu.Item onClick={onExportPdf}>PDF</Menu.Item>
              </Menu.Dropdown>
            </Menu>
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
      </Collapse>
    </Card>
  );
}
