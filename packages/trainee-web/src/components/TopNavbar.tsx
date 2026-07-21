import React from 'react';
import { Layout } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { useTranslation } from 'react-i18next';

const { Header } = Layout;

interface TopNavbarProps {
  title?: string;
  status?: string;
  actions?: React.ReactNode;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ title, status, actions }) => {
  const { courseId } = useParams<{ courseId: string }>();
  const { t } = useTranslation('common');

  return (
    <Header className="bg-slate-900 px-6 flex items-center justify-between shadow-md z-10 relative">
      <div className="flex items-center space-x-4">
        <div className="text-white font-bold text-xl tracking-wider flex items-center cursor-pointer">
          <Link to="/dashboard" className="text-white hover:text-white flex items-center">
            <span className="text-blue-400 mr-2">✦</span> Antigravity
          </Link>
        </div>
        {title && (
          <div className="flex items-center">
            <div className="text-gray-400 text-sm pl-4 border-l border-gray-700 hidden md:block">
              {title}
            </div>
            {status && (
              <div
                className={`ml-3 text-xs px-2 py-0.5 rounded-full ${status === 'Saved' ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'}`}
              >
                {status}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center space-x-6">
        {actions && <div className="flex items-center">{actions}</div>}
        {courseId && (
          <Link
            to={`/mission-hub/${courseId}`}
            className="text-gray-300 hover:text-white text-sm font-medium transition-colors mr-4"
          >
            {t('nav.missionHub', 'Mission Hub')}
          </Link>
        )}
        <Link
          to="/dashboard"
          className="text-gray-300 hover:text-white text-sm font-medium transition-colors"
        >
          {t('nav.dashboard', 'Dashboard')}
        </Link>

        <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-gray-700">
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </Header>
  );
};
