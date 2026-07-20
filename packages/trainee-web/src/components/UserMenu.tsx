import React from 'react';
import { Dropdown, Avatar } from 'antd';
import { UserOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { logout } from '../store/authSlice';
import type { MenuProps } from 'antd';

/**
 * UserMenu dropdown displaying user info and logout action.
 * Replaces the static avatar icon in TopNavbar.
 */
export const UserMenu: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  const items: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div className="px-1 py-1">
          <div className="font-semibold text-gray-800">{user?.name ?? 'User'}</div>
          <div className="text-xs text-gray-500">{user?.role ?? 'TRAINEE'}</div>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'organization',
      icon: <TeamOutlined />,
      label: (
        <span className="text-gray-600 text-sm">
          Org: {user?.organizationId ? user.organizationId.substring(0, 8) + '...' : 'N/A'}
        </span>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'settings',
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 shadow-inner cursor-pointer hover:bg-slate-600 transition-colors">
        <Avatar
          size={32}
          icon={<UserOutlined />}
          className="bg-transparent text-slate-300"
          style={{ fontSize: 14 }}
        />
      </div>
    </Dropdown>
  );
};
