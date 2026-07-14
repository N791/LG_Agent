import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/authSlice';

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
});

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

request.interceptors.response.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  (response) => response.data,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      store.dispatch(logout());
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);

export default request;
