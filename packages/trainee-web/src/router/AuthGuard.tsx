import React from 'react';
import { Navigate, Outlet, useLocation, useMatches } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { authService } from '../services/authService';
import { Spin } from 'antd';
import { type MePermissionsDTO } from '@lg-agent/contracts';
import { PermissionProvider, PermissionRouteBoundary } from '@lg-agent/permission-react';
import request from '../utils/request';
import { useTranslation } from 'react-i18next';

const loadPermissions = () => request.get<unknown, MePermissionsDTO>('/me/permissions');

const AuthorizedOutlet: React.FC = () => {
  const matches = useMatches();
  const { t } = useTranslation('common');
  return (
    <PermissionRouteBoundary
      routeHandles={matches.map(({ handle }) => handle)}
      loadingFallback={<PermissionState title={t('permissionSession.loading')} loading />}
      serviceUnavailableFallback={
        <PermissionState
          title={t('permissionSession.serviceUnavailable')}
          detail={t('permissionSession.serviceUnavailableDetail')}
        />
      }
      versionMismatchFallback={
        <PermissionState
          title={t('permissionSession.updateRequired')}
          detail={t('permissionSession.updateRequiredDetail')}
        />
      }
      sessionDeniedFallback={
        <PermissionState
          title={t('permissionSession.unauthorized')}
          detail={t('permissionSession.signInAgain')}
        />
      }
      routeDeniedFallback={<Navigate to="/dashboard" replace state={{ permissionDenied: true }} />}
    >
      <Outlet />
    </PermissionRouteBoundary>
  );
};

const PermissionState: React.FC<{ title: string; detail?: string; loading?: boolean }> = ({
  title,
  detail,
  loading = false,
}) => (
  <div className="h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      {loading ? <Spin size="large" /> : null}
      <p className="mt-4 font-medium text-gray-700">{title}</p>
      {detail ? <p className="mt-2 text-gray-500">{detail}</p> : null}
    </div>
  </div>
);

/**
 * Enhanced AuthGuard:
 * - Checks token existence AND expiry
 * - If access_token expired but refresh_token exists → show loading (SessionProvider handles refresh)
 * - If no tokens at all → redirect to login
 */
const AuthGuard: React.FC = () => {
  const { t } = useTranslation('common');
  const token = useSelector((state: RootState) => state.auth.token);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
  const user = useSelector((state: RootState) => state.auth.user);
  const location = useLocation();

  // No tokens at all → redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Token expired but refresh token available → SessionProvider will handle refresh
  // Show a loading state while the refresh is in progress
  if (authService.isTokenExpired(token) && refreshToken) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-500">{t('permissionSession.restoring')}</p>
        </div>
      </div>
    );
  }

  // Token expired and no refresh token → redirect to login
  if (authService.isTokenExpired(token) && !refreshToken) {
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
