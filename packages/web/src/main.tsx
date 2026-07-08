import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { router } from './router';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Provider store={store}>
        <ConfigProvider locale={zhCN}>
          {/* 
            Temporary Workaround
            Root Cause: router is temporarily typed as 'any' to avoid TS2742 (@remix-run/router inference error).
            Issue: #TODO-1 
            Removal Condition: Remove when @remix-run/router types are explicitly imported or dependency issue is fixed.
          */}
          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
          <RouterProvider router={router} />
        </ConfigProvider>
      </Provider>
    </StrictMode>,
  );
}
