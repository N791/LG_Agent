import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { authService } from '../services/authService';
import { Spin } from 'antd';

/**
 * Enhanced AuthGuard:
 * - Checks token existence AND expiry
 * - If access_token expired but refresh_token exists → show loading (SessionProvider handles refresh)
 * - If no tokens at all → redirect to login
 */
const AuthGuard: React.FC = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
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
          <p className="mt-4 text-gray-500">Restoring session...</p>
        </div>
      </div>
    );
  }

  // Token expired and no refresh token → redirect to login
  if (authService.isTokenExpired(token) && !refreshToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default AuthGuard;
