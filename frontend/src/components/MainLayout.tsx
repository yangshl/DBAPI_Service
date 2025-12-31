import React from 'react';
import { Layout, Menu, Dropdown, Avatar, Space } from 'antd';
import {
  DashboardOutlined,
  ApiOutlined,
  DatabaseOutlined,
  UserOutlined,
  FileTextOutlined,
  LogoutOutlined,
  SafetyOutlined,
  BookOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionContext';

const { Header, Sider, Content, Footer } = Layout;

interface MainLayoutProps {
  user: {
    username: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
      permission: 'dashboard'
    },
    {
      key: '/apis',
      icon: <ApiOutlined />,
      label: 'API管理',
      permission: 'api_view'
    },
    {
      key: '/datasources',
      icon: <DatabaseOutlined />,
      label: '数据源管理',
      permission: 'datasource_view'
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
      permission: 'user_view'
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '操作日志',
      permission: 'log_view'
    },
    {
      key: '/permissions',
      icon: <SafetyOutlined />,
      label: '权限管理',
      permission: 'permission_view'
    },
    {
      key: '/system',
      icon: <SettingOutlined />,
      label: '系统配置',
      permission: 'system_config'
    },
    {
      key: '/docs',
      icon: <BookOutlined />,
      label: '接口文档',
      permission: null
    }
  ].filter(item => !item.permission || hasPermission(item.permission));

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold'
        }}>
          DBAPI Service
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            if (key === '/docs') {
              window.open('/docs', '_blank');
            } else {
              navigate(key);
            }
          }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: 'white',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div />
          <Space>
            <span>{user.username}</span>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
        <Footer style={{
          textAlign: 'center',
          padding: '16px 50px',
          background: '#f0f2f5',
          borderTop: '1px solid #e8e8e8'
        }}>
          Copyright © 2023-2025 Cabin Studio
        </Footer>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
