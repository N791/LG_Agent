import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthGuard from './AuthGuard';
import { PageLoader } from '../components/PageLoader';
import { RouteError } from '../components/RouteError';
import type { Router } from '@remix-run/router';

const MissionHub = React.lazy(() => import('../pages/MissionHub'));
const WorkspacePage = React.lazy(() => import('../pages/Workspace'));
const Dashboard = React.lazy(() => import('../pages/Dashboard'));
const Login = React.lazy(() => import('../pages/Login'));
const Settings = React.lazy(() =>
  import('../pages/Settings').then((module) => ({ default: module.Settings })),
);

const withSuspense = (Component: React.FC) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const router: Router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
    errorElement: <RouteError />,
  },
  {
    path: '/login',
    element: withSuspense(Login),
  },
  {
    path: '/',
    element: <AuthGuard />,
    errorElement: <RouteError />,
    children: [
      {
        path: '/dashboard',
        element: withSuspense(Dashboard),
      },
      {
        path: '/mission-hub/:courseId',
        element: withSuspense(MissionHub),
      },
      {
        path: '/course/:courseId/workspace/:taskId',
        element: withSuspense(WorkspacePage),
      },
      {
        path: '/settings',
        element: withSuspense(Settings as React.FC),
      },
    ],
  },
]);
