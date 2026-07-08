import { createBrowserRouter } from 'react-router-dom';
import AuthGuard from './AuthGuard';
import AdminLayout from '../layouts/AdminLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Users from '../pages/Users';
import Organizations from '../pages/Organizations';
import Courses from '../pages/Courses';
import Tasks from '../pages/Tasks';

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
          },
          {
            path: 'organizations',
            element: <Organizations />,
          },
          {
            path: 'users',
            element: <Users />,
          },
          {
            path: 'courses',
            element: <Courses />,
          },
          {
            path: 'courses/:courseId/tasks',
            element: <Tasks />,
          },
        ],
      },
    ],
  },
]);
