import {
  AppShell,
  Group,
  Text,
  Badge,
  ActionIcon,
  useMantineTheme,
  useMantineColorScheme,
  useComputedColorScheme,
  Paper,
} from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import React from 'react';

const StatusBadge = ({ label, ok }: { label: string; ok: boolean }) => (
  <Badge color={ok ? 'green' : 'red'} variant="light">
    {label}: {ok ? '✅' : '⚠️'}
  </Badge>
);

type Props = {
  children: React.ReactNode;
  linearOk: boolean;
  openaiOk: boolean;
  lastRefreshed?: Date | null;
  cacheInfo?: { count: number; from?: string; to?: string };
};

export default function Layout({ children, linearOk, openaiOk, lastRefreshed, cacheInfo }: Props) {
  const theme = useMantineTheme();
  const { toggleColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const refreshedLabel = lastRefreshed
    ? `Last Refreshed: ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Last Refreshed: --:--';

  return (
    <AppShell
      header={{ height: 64 }}
      padding="md"
      styles={{
        main: {
          minHeight: '100vh',
          backgroundColor: colorScheme === 'dark' ? theme.colors.dark[7] : theme.colors.gray[0],
        },
      }}
    >
      <AppShell.Header p="sm" withBorder={false}>
        <Paper
          radius="md"
          shadow="sm"
          px="md"
          py="xs"
          style={{
            backgroundColor: colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Group>
            <Text fw={700}>Linear Analytics</Text>
            <StatusBadge label="Linear" ok={linearOk} />
            <StatusBadge label="OpenAI" ok={openaiOk} />
            <Text size="sm" c="dimmed">
              {refreshedLabel}
            </Text>
            {cacheInfo && (
              <Text size="sm" c="dimmed">
                Cache: {cacheInfo.count} issues{cacheInfo.from && cacheInfo.to ? ` (${new Date(cacheInfo.from).toLocaleDateString()} – ${new Date(cacheInfo.to).toLocaleDateString()})` : ''}
              </Text>
            )}
          </Group>
          <ActionIcon variant="subtle" onClick={() => toggleColorScheme()} aria-label="Toggle theme">
            {colorScheme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
          </ActionIcon>
        </Paper>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
