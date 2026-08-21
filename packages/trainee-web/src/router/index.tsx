import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthGuard from './AuthGuard';
import { PageLoader } from '../components/PageLoader';
import { RouteError } from '../components/RouteError';
import type { Router } from '@remix-run/router';
import { PERMISSIONS } from '@lg-agent/contracts';

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
        handle: { permission: PERMISSIONS.TRAINING_READ },
      },
      {
        path: '/mission-hub/:courseId',
        element: withSuspense(MissionHub),
        handle: { permission: PERMISSIONS.COURSE_READ },
      },
      {
        path: '/course/:courseId/workspace/:taskId',
        element: withSuspense(WorkspacePage),
        handle: { permission: PERMISSIONS.WORKSPACE_USE },
      },
      {
        path: '/settings',
        element: withSuspense(Settings as React.FC),
        handle: { permission: PERMISSIONS.PROFILE_READ },
      },
    ],
  },
]);
