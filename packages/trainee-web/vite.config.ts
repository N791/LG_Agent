import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lg-agent/contracts': path.resolve(__dirname, '../contracts/src/index.ts'),
    },
  },
  server: {
    port: 8081,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons', 'rc-virtual-list'],
          'monaco-vendor': ['monaco-editor', '@monaco-editor/react'],
          'state-vendor': ['react-redux', '@reduxjs/toolkit', 'zustand'],
          'utils-vendor': ['axios', 'date-fns', 'socket.io-client', 'lucide-react'],
        },
      },
    },
  },
});
