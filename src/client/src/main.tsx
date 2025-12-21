import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, ColorSchemeScript, localStorageColorSchemeManager } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';

const queryClient = new QueryClient();
const colorSchemeManager = localStorageColorSchemeManager({ key: 'linear-theme' });

function Root() {
  return (
    <React.StrictMode>
      <ColorSchemeScript defaultColorScheme="light" />
      <MantineProvider
        defaultColorScheme="light"
        colorSchemeManager={colorSchemeManager}
        withNormalizeCSS
        withGlobalStyles
        theme={{
          primaryColor: 'blue',
          defaultRadius: 'md',
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          colors: {
            blue: ['#e9f2ff', '#d2e4ff', '#a7c9ff', '#7badff', '#4f92ff', '#1f78ff', '#0e66e6', '#0b52b4', '#083d82', '#052951'],
            slate: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
          },
        }}
      >
        <Notifications position="top-right" />
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MantineProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
