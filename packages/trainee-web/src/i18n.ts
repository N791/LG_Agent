import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonZhCN from './locales/zh-CN/common.json';
import authZhCN from './locales/zh-CN/auth.json';
import missionHubZhCN from './locales/zh-CN/missionHub.json';
import workspaceZhCN from './locales/zh-CN/workspace.json';
import dashboardZhCN from './locales/zh-CN/dashboard.json';
import settingsZhCN from './locales/zh-CN/settings.json';

const resources = {
  'zh-CN': {
    common: commonZhCN,
    auth: authZhCN,
    missionHub: missionHubZhCN,
    workspace: workspaceZhCN,
    dashboard: dashboardZhCN,
    settings: settingsZhCN,
  },
};

void i18n.use(initReactI18next).init(
  {
    resources,
    lng: 'zh-CN', // Default language
    fallbackLng: 'zh-CN', // Fallback language
    ns: ['common', 'auth', 'missionHub', 'workspace', 'dashboard'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes values to prevent XSS
    },
  },
  () => {
    console.log('i18next initialized in trainee-web', {
      lng: i18n.language,
      resources: i18n.options.resources,
      testAuth: i18n.t('auth:loginTitle'),
      testWorkspace: i18n.t('workspace:leftPanel.explorer.title'),
    });
  },
);

export default i18n;
