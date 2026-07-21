import i18next from 'i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import { getGlobalConfig } from './config';

export const initI18n = async () => {
  const config = getGlobalConfig();
  const locale = config.locale ?? 'zh-CN';

  await i18next.init({
    lng: locale,
    fallbackLng: 'en-US',
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
  });
};

export const t = (key: string, options?: Record<string, unknown>): string => {
  return i18next.t(key, options);
};
