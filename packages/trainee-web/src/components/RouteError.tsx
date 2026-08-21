import React from 'react';
import { Result, Button } from 'antd';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopNavbar } from './TopNavbar';

export const RouteError: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  let status: 403 | 404 | 500 = 500;
  let title = t('errors.title');
  let subTitle = t('errors.unexpected');

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      status = 404;
      title = '404';
      subTitle = t('errors.notFound');
    } else if (error.status === 403) {
      status = 403;
      title = '403';
      subTitle = t('errors.forbidden');
    } else {
      status = 500;
      title = error.status.toString();
      subTitle = error.statusText;
    }
  } else if (error instanceof Error) {
    subTitle = error.message;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNavbar title={t('errors.pageTitle')} />
      <div className="flex-1 flex items-center justify-center">
        <Result
          status={status}
          title={title}
          subTitle={subTitle}
          extra={
            <Button
              type="primary"
              onClick={() => {
                navigate('/dashboard');
              }}
            >
              {t('actions.backHome')}
            </Button>
          }
        />
      </div>
    </div>
  );
};
