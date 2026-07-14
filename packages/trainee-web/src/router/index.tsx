import { createBrowserRouter, Navigate } from 'react-router-dom';
import MissionHub from '../pages/MissionHub';
import WorkspacePage from '../pages/Workspace';
import Login from '../pages/Login';
import AuthGuard from './AuthGuard';

import type { Router } from '@remix-run/router';

export const router: Router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/mission-hub" replace />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        path: '/mission-hub',
        element: <MissionHub />,
      },
      {
        path: '/workspace/:taskId',
        element: <WorkspacePage />,
      },
    ],
  },
]);
