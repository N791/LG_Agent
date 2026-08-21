import { Navigate, Outlet, useLocation, useMatches } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import Forbidden from '../pages/Forbidden';
import { type MePermissionsDTO } from '@lg-agent/contracts';
import { PermissionProvider, PermissionRouteBoundary } from '@lg-agent/permission-react';
import request from '../utils/request';
import { Result, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

const loadPermissions = () => request.get<unknown, MePermissionsDTO>('/me/permissions');

const AuthorizedOutlet = () => {
  const matches = useMatches();
  const { t } = useTranslation('admin');
  return (
    <PermissionRouteBoundary
      routeHandles={matches.map(({ handle }) => handle)}
      loadingFallback={<Spin fullscreen tip={t('permissionSession.loading')} />}
      serviceUnavailableFallback={
        <Result
          status="500"
          title={t('permissionSession.serviceUnavailable')}
          subTitle={t('permissionSession.retry')}
        />
      }
      versionMismatchFallback={
        <Result
          status="warning"
          title={t('permissionSession.versionMismatch')}
          subTitle={t('permissionSession.versionMismatchDetail')}
        />
      }
      sessionDeniedFallback={<Forbidden />}
      routeDeniedFallback={<Forbidden />}
    >
      <Outlet />
    </PermissionRouteBoundary>
  );
};

const AuthGuard = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <PermissionProvider
      identityKey={`${user?.id ?? 'unknown'}:${user?.organizationId ?? 'unknown'}:${token}`}
      loadPermissions={loadPermissions}
    >
      <AuthorizedOutlet />
    </PermissionProvider>
  );
};

export default AuthGuard;
