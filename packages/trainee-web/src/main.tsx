import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store';
import { router } from './router';
import { SessionProvider } from './components/SessionProvider';
import { NotificationProvider } from './contexts/NotificationContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { telemetry } from './utils/telemetry';
import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from 'web-vitals';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Set up global error handlers
window.addEventListener('error', (event) => {
  const err = event.error as Error | undefined;
  telemetry.logError(event.message, err?.stack, { type: 'uncaughtException', filename: event.filename, lineno: event.lineno, colno: event.colno });
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as Error | undefined;
  telemetry.logError(reason?.message ?? 'Unhandled Promise Rejection', reason?.stack, { type: 'unhandledRejection' });
});

// Set up web-vitals reporting
const reportVital = (metric: Metric) => {
  telemetry.recordMetric(metric.name, metric.value, metric.rating, { id: metric.id, delta: metric.delta, navigationType: metric.navigationType });
};
onLCP(reportVital);
onCLS(reportVital);
onINP(reportVital);
onFCP(reportVital);
onTTFB(reportVital);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No root element found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
          <ErrorBoundary>
            <SessionProvider>
              <NotificationProvider>
                <RouterProvider router={router} />
              </NotificationProvider>
            </SessionProvider>
          </ErrorBoundary>
        </ConfigProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
);
