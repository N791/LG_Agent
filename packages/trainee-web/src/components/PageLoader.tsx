import React from 'react';
import { Spin } from 'antd';

export const PageLoader: React.FC = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
      <Spin size="large" />
    </div>
  );
};
