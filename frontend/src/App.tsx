import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { message } from 'antd';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApiList from './pages/ApiList';
import ApiCreate from './pages/ApiCreate';
import ApiAccessLogs from './pages/ApiAccessLogs';
import ApiAutoGenerate from './pages/ApiAutoGenerate';
import DatasourceList from './pages/DatasourceList';
import DatasourceCreate from './pages/DatasourceCreate';
import DatasourceEdit from './pages/DatasourceEdit';
import UserList from './pages/UserList';
import LogList from './pages/LogList';
import PermissionList from './pages/PermissionList';
import ApiDocs from './pages/ApiDocs';
import SystemConfig from './pages/SystemConfig';
import MainLayout from './components/MainLayout';
import { PermissionProvider } from './contexts/PermissionContext';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
    message.success('退出登录成功');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      <Route path="/docs" element={<ApiDocs />} />
      <Route path="/docs/:apiId" element={<ApiDocs />} />
      
      {!user ? (
        <Route path="*" element={<Navigate to="/login" replace />} />
      ) : (
        <Route path="/" element={
          <PermissionProvider userRole={user.role}>
            <MainLayout user={user} onLogout={handleLogout}>
              <Outlet />
            </MainLayout>
          </PermissionProvider>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="apis" element={<ApiList />} />
          <Route path="apis/create" element={<ApiCreate />} />
          <Route path="apis/auto-generate" element={<ApiAutoGenerate />} />
          <Route path="apis/:id/edit" element={<ApiCreate />} />
          <Route path="apis/:id/access-logs" element={<ApiAccessLogs />} />
          <Route path="datasources" element={<DatasourceList />} />
          <Route path="datasources/create" element={<DatasourceCreate />} />
          <Route path="datasources/:id/edit" element={<DatasourceEdit />} />
          <Route path="users" element={<UserList />} />
          <Route path="logs" element={<LogList />} />
          <Route path="permissions" element={<PermissionList />} />
          <Route path="system" element={<SystemConfig />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;
