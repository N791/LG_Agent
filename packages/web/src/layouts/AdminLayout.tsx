import { Layout, Menu, Button, Dropdown } from 'antd';
import {
  UserOutlined,
  BookOutlined,
  DashboardOutlined,
  LineChartOutlined,
  MonitorOutlined,
  LogoutOutlined,
  SettingOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearAuth } from '../store/slices/authSlice';
import { RootState } from '../store';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS, type Permission } from '@lg-agent/contracts';
import { usePermissionMenu } from '@lg-agent/permission-react';
import lgAgentMark from '../assets/lg-agent-mark.svg';

const { Header, Sider, Content } = Layout;

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const { t } = useTranslation('navigation');

  const handleLogout = () => {
    dispatch(clearAuth());
    navigate('/login');
  };

  const allMenuItems: {
    key: string;
    icon: React.ReactNode;
    label: string;
    permission: Permission;
  }[] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('dashboard'),
      permission: PERMISSIONS.ANALYTICS_READ,
    },
    {
      key: '/organizations',
      icon: <BookOutlined />,
      label: t('organizations'),
      permission: PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE,
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: t('users'),
      permission: PERMISSIONS.USER_READ,
    },
    {
      key: '/courses',
      icon: <BookOutlined />,
      label: t('courses'),
      permission: PERMISSIONS.COURSE_READ,
    },
    {
      key: '/submissions',
      icon: <LineChartOutlined />,
      label: t('learningAnalytics'),
      permission: PERMISSIONS.SUBMISSION_READ,
    },
    {
      key: '/observability',
      icon: <MonitorOutlined />,
      label: t('observability'),
      permission: PERMISSIONS.OBSERVABILITY_READ,
    },
    {
      key: '/retrieval',
      icon: <SearchOutlined />,
      label: t('retrieval'),
      permission: PERMISSIONS.AI_RETRIEVAL_READ,
    },
    {
      key: '/ai-settings',
      icon: <SettingOutlined />,
      label: t('aiSettings'),
      permission: PERMISSIONS.SYSTEM_CONFIG_READ,
    },
    {
      key: '/authorization',
      icon: <SafetyCertificateOutlined />,
      label: t('authorization'),
      permission: PERMISSIONS.ROLE_READ,
    },
  ];

  const menuItems = usePermissionMenu(allMenuItems);

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('logout'),
        onClick: handleLogout,
      },
    ],
  };

  return (
    <Layout className="min-h-screen">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => {
          setCollapsed(value);
        }}
        theme="light"
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-100 px-3">
          <div className="flex items-center gap-2.5 overflow-hidden" aria-label="LG Agent 管理后台">
            <img src={lgAgentMark} alt="" className="h-9 w-9 shrink-0" />
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-base font-semibold tracking-tight text-slate-900">
                  LG Agent
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Admin
                </div>
              </div>
            )}
          </div>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
          }}
          className="mt-2 border-r-0"
        />
      </Sider>
      <Layout>
        <Header className="bg-white p-0 px-6 flex justify-between items-center shadow-sm z-10">
          <div className="text-lg font-medium"></div>
          <div className="flex items-center gap-4">
            <Dropdown menu={userMenu} placement="bottomRight">
              <Button type="text" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  {user?.username.charAt(0).toUpperCase() ?? 'U'}
                </div>
                <span>{user?.nickname ?? user?.username}</span>
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content className="m-6 bg-white p-6 rounded-lg shadow-sm min-h-[280px]">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
