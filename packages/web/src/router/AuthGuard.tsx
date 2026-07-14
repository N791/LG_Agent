import { Navigate, Outlet, useLocation, useMatches } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import Forbidden from '../pages/Forbidden';

const AuthGuard = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const location = useLocation();
  const matches = useMatches();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Find the deepest match that specifies allowed roles
  const matchWithRoles = [...matches].reverse().find((match) => {
    const handle = match.handle as { roles?: string[] } | undefined;
    return handle?.roles && handle.roles.length > 0;
  });

  if (matchWithRoles) {
    const handle = matchWithRoles.handle as { roles: string[] };
    if (!handle.roles.includes(user?.role ?? '')) {
      return <Forbidden />;
    }
  }

  return <Outlet />;
};

export default AuthGuard;
