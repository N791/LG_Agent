import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store';
import { setTokens, logout } from '../store/authSlice';
import { authService } from '../services/authService';

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
});

/**
 * Mutex lock to prevent concurrent refresh token calls.
 * When a 401 occurs, only the first request triggers a refresh;
 * subsequent 401s queue and resolve once refresh completes.
 */
let isRefreshing = false;
let pendingQueue: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}[] = [];

const processPendingQueue = (error: Error | null, token: string | null) => {
  pendingQueue.forEach((item) => {
    if (error) {
      item.reject(error);
    } else if (token) {
      item.resolve(token);
    }
  });
  pendingQueue = [];
};

/**
 * Request interceptor: attach Bearer token from Redux store.
 */
request.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error instanceof Error ? error : new Error(String(error))),
);

/**
 * Response interceptor: unwrap response data + automatic token refresh on 401.
 */
request.interceptors.response.use(
  (response) => {
    const res = response.data as { code?: number; message?: string; data?: unknown };
    if (res.code !== undefined && res.code !== 200 && res.code !== 201) {
      return Promise.reject(new Error(res.message ?? 'Request failed'));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return res.data !== undefined ? (res.data as any) : res;
  },
  async (error: unknown) => {
    const axiosError = error as AxiosError;
    const originalRequest = axiosError.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };

    // Only attempt refresh for 401 responses that haven't already been retried
    if (axiosError.response?.status === 401 && !originalRequest._retried) {
      const refreshToken = store.getState().auth.refreshToken;

      // No refresh token available → force logout
      if (!refreshToken) {
        store.dispatch(logout());
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(axiosError);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          originalRequest._retried = true;
          return request(originalRequest);
        });
      }

      isRefreshing = true;
      originalRequest._retried = true;

      try {
        const tokens = await authService.refreshTokens(refreshToken);
        const decoded = authService.decodeToken(tokens.access_token);

        store.dispatch(
          setTokens({
            token: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: decoded.exp * 1000,
          }),
        );

        processPendingQueue(null, tokens.access_token);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
        return await request(originalRequest);
      } catch (refreshError) {
        // Refresh failed → force logout
        const errorObj =
          refreshError instanceof Error ? refreshError : new Error('Token refresh failed');
        processPendingQueue(errorObj, null);
        store.dispatch(logout());
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return await Promise.reject(errorObj);
      } finally {
        isRefreshing = false;
      }
    }

    // Non-401 errors or already retried → reject
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);

export default request;
