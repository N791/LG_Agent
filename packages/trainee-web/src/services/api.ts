import axios from 'axios';
import i18n from '../i18n';

const api = axios.create({
  baseURL: (import.meta.env as Record<string, string>)['VITE_API_URL'] ?? '/api/v1',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use((response) => {
  const res = response.data as { code?: number; message?: string; data?: unknown };
  if (res.code !== undefined && res.code !== 200 && res.code !== 201) {
    return Promise.reject(new Error(res.message ?? i18n.t('common:requestFailed')));
  }
  if (res.data !== undefined) {
    response.data = res.data;
  }
  return response;
});

export default api;
