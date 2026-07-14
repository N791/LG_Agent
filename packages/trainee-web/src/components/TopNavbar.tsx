import React from 'react';
import { Layout } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Header } = Layout;

interface TopNavbarProps {
  title?: string;
  actions?: React.ReactNode;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ title, actions }) => {
  return (
    <Header className="bg-slate-900 px-6 flex items-center justify-between shadow-md z-10 relative">
      <div className="flex items-center space-x-4">
        <div className="text-white font-bold text-xl tracking-wider flex items-center cursor-pointer">
          <Link to="/mission-hub" className="text-white hover:text-white flex items-center">
            <span className="text-blue-400 mr-2">✦</span> Antigravity
          </Link>
        </div>
        {title && (
          <div className="text-gray-400 text-sm pl-4 border-l border-gray-700 hidden md:block">
            {title}
          </div>
        )}
      </div>
      <div className="flex items-center space-x-6">
        {actions && <div className="flex items-center">{actions}</div>}
        <Link
          to="/mission-hub"
          className="text-gray-300 hover:text-white text-sm font-medium transition-colors"
        >
          Mission Hub
        </Link>
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 shadow-inner cursor-pointer hover:bg-slate-600 transition-colors">
          <UserOutlined className="text-slate-300" />
        </div>
      </div>
    </Header>
  );
};
