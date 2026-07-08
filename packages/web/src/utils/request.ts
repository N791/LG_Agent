import axios from 'axios';
import { message } from 'antd';
import { store } from '../store';
import { clearAuth } from '../store/slices/authSlice';

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
  (response) => {
    const {
      code,
      message: msg,
      data,
    } = response.data as { code: number; message: string; data: unknown };
    if (code !== 200 && code !== 201) {
      message.error(msg ?? 'Request failed');
      return Promise.reject(new Error(msg ?? 'Error'));
    }
    return data;
  },
  (error: import('axios').AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      store.dispatch(clearAuth());
      // Handle redirect to login if necessary
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else {
      message.error(error.response?.data?.message ?? 'Network Error');
    }
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);

export default request;
