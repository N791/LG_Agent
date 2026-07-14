import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const Forbidden: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center h-full">
      <Result
        status="403"
        title="403"
        subTitle="Sorry, you are not authorized to access this page."
        extra={
          <Button
            type="primary"
            onClick={() => {
              navigate('/');
            }}
          >
            Back Home
          </Button>
        }
      />
    </div>
  );
};

export default Forbidden;
