import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonZhCN from './locales/zh-CN/common.json';
import navigationZhCN from './locales/zh-CN/navigation.json';
import authZhCN from './locales/zh-CN/auth.json';
import dashboardZhCN from './locales/zh-CN/dashboard.json';
import aiZhCN from './locales/zh-CN/ai.json';
import submissionsZhCN from './locales/zh-CN/submissions.json';
import observabilityZhCN from './locales/zh-CN/observability.json';

import submissionsEnUS from './locales/en-US/submissions.json';
import observabilityEnUS from './locales/en-US/observability.json';

const resources = {
  'en-US': {
    submissions: submissionsEnUS,
    observability: observabilityEnUS,
  },
  'zh-CN': {
    common: commonZhCN,
    navigation: navigationZhCN,
    auth: authZhCN,
    dashboard: dashboardZhCN,
    ai: aiZhCN,
    submissions: submissionsZhCN,
    observability: observabilityZhCN,
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-CN', // Default language
  fallbackLng: 'zh-CN', // Fallback language
  ns: ['common', 'navigation', 'auth', 'dashboard', 'ai', 'submissions', 'observability'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false, // React already escapes values to prevent XSS
  },
});

export default i18n;
