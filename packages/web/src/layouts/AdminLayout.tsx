import { Layout, Menu, Button, Dropdown } from 'antd';
import {
  UserOutlined,
  BookOutlined,
  DashboardOutlined,
  LineChartOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearAuth } from '../store/slices/authSlice';
import { RootState } from '../store';
import React, { useState } from 'react';

const { Header, Sider, Content } = Layout;

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const handleLogout = () => {
    dispatch(clearAuth());
    navigate('/login');
  };

  const allMenuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '控制台',
      roles: ['ADMIN', 'MENTOR'],
    },
    {
      key: '/organizations',
      icon: <BookOutlined />,
      label: '组织管理',
      roles: ['ADMIN'],
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
      roles: ['ADMIN', 'MENTOR'],
    },
    {
      key: '/courses',
      icon: <BookOutlined />,
      label: '课程管理',
      roles: ['ADMIN', 'MENTOR'],
    },
    {
      key: '/submissions',
      icon: <LineChartOutlined />,
      label: 'Learning Analytics',
      roles: ['ADMIN', 'MENTOR'],
    },
  ];

  const menuItems = allMenuItems.filter((item) => item.roles.includes(user?.role ?? ''));

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
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
        <div className="h-16 flex items-center justify-center font-bold text-xl tracking-tight border-b border-gray-100">
          {collapsed ? 'LG' : 'LG Agent'}
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
