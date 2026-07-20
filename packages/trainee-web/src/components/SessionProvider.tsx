import React, { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setTokens, logout } from '../store/authSlice';
import { authService } from '../services/authService';

/**
 * Proactive refresh buffer: refresh token 60 seconds before it expires.
 */
const REFRESH_BUFFER_MS = 60 * 1000;

/**
 * Minimum interval between refresh attempts to prevent rapid retries.
 */
const MIN_REFRESH_INTERVAL_MS = 10 * 1000;

/**
 * SessionProvider manages token lifecycle:
 * - On mount: validates existing tokens; refreshes if access_token expired but refresh_token valid
 * - Sets up proactive refresh timer to silently refresh before token expiry
 * - Cleans up timer on unmount
 */
export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
  const tokenExpiresAt = useSelector((state: RootState) => state.auth.tokenExpiresAt);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const performRefresh = useCallback(async () => {
    if (!refreshToken) {
      dispatch(logout());
      return;
    }

    try {
      const tokens = await authService.refreshTokens(refreshToken);
      const decoded = authService.decodeToken(tokens.access_token);

      dispatch(
        setTokens({
          token: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: decoded.exp * 1000,
        }),
      );
    } catch {
      // Refresh failed — session expired
      dispatch(logout());
    }
  }, [refreshToken, dispatch]);

  /**
   * Schedule proactive refresh based on token expiry.
   */
  const scheduleRefresh = useCallback(
    (expiresAt: number) => {
      clearRefreshTimer();

      const msUntilExpiry = expiresAt - Date.now();
      const refreshIn = Math.max(msUntilExpiry - REFRESH_BUFFER_MS, MIN_REFRESH_INTERVAL_MS);

      refreshTimerRef.current = setTimeout(() => {
        void performRefresh();
      }, refreshIn);
    },
    [clearRefreshTimer, performRefresh],
  );

  const hasInitialized = useRef(false);

  /**
   * On mount: validate session state.
   * Uses a ref to ensure this only runs once.
   */
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    if (!token || !refreshToken) return;

    if (authService.isTokenExpired(token)) {
      // Access token expired, try refresh
      void performRefresh();
    }
  }, [token, refreshToken, performRefresh]);

  /**
   * When tokenExpiresAt changes (login or refresh), schedule next proactive refresh.
   */
  useEffect(() => {
    if (tokenExpiresAt && token) {
      scheduleRefresh(tokenExpiresAt);
    }

    return () => {
      clearRefreshTimer();
    };
  }, [tokenExpiresAt, token, scheduleRefresh, clearRefreshTimer]);

  return <>{children}</>;
};
