import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('admin');
  return (
    <div className="flex items-center justify-center h-full">
      <Result
        status="404"
        title="404"
        subTitle={t('errors.notFound')}
        extra={
          <Button
            type="primary"
            onClick={() => {
              navigate('/');
            }}
          >
            {t('errors.backHome')}
          </Button>
        }
      />
    </div>
  );
};

export default NotFound;
