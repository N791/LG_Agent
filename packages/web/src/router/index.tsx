import { createBrowserRouter } from 'react-router-dom';
import AuthGuard from './AuthGuard';
import AdminLayout from '../layouts/AdminLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Users from '../pages/Users';
import Organizations from '../pages/Organizations';
import Courses from '../pages/Courses';
import Tasks from '../pages/Tasks';
import { TaskEditorPage } from '../pages/Tasks/TaskEditorPage';
import { GenerateTaskPage } from '../pages/Tasks/GenerateTaskPage';
import Submissions from '../pages/Submissions';
import Observability from '../pages/Observability';
import AiSettings from '../pages/AiSettings';
import NotFound from '../pages/NotFound';

/*
  Temporary Workaround
  Root Cause: pnpm strict isolation causes TS2742 where @remix-run/router is required but not directly referenced.
  Issue: #TODO-1
  Removal Condition: Remove when react-router-dom types are correctly resolved or @remix-run/router is added to devDependencies.
*/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const router: any = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        path: '/',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Dashboard />,
            handle: { roles: ['ADMIN', 'MENTOR'] },
          },
          {
            path: 'organizations',
            element: <Organizations />,
            handle: { roles: ['ADMIN'] },
          },
          {
            path: 'users',
            element: <Users />,
            handle: { roles: ['ADMIN', 'MENTOR'] },
          },
          {
            path: 'courses',
            element: <Courses />,
            handle: { roles: ['ADMIN', 'MENTOR'] },
          },
          {
            path: 'courses/:courseId/tasks',
            element: <Tasks />,
            handle: { roles: ['ADMIN', 'MENTOR'] },
          },
          {
            path: 'courses/:courseId/tasks/:taskId/edit',
            element: <TaskEditorPage />,
            handle: { roles: ['ADMIN', 'MENTOR'] },
          },
          {
            path: 'courses/:courseId/tasks/generate',
            element: <GenerateTaskPage />,
            handle: { roles: ['ADMIN', 'MENTOR'] },
          },
          {
            path: 'submissions',
            element: <Submissions />,
            handle: { roles: ['ADMIN', 'MENTOR'] },
          },
          {
            path: 'observability',
            element: <Observability />,
            handle: { roles: ['ADMIN'] },
          },
          {
            path: 'ai-settings',
            element: <AiSettings />,
            handle: { roles: ['ADMIN'] },
          },
          {
            path: '*',
            element: <NotFound />,
          },
        ],
      },
    ],
  },
]);
