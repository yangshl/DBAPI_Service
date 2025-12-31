import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import { ApiOutlined, DatabaseOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';

interface DashboardStats {
  overview: {
    totalApis: number;
    totalDatasources: number;
    totalUsers: number;
    totalCalls: number;
    todayCalls: number;
  };
  topApis: Array<{
    name: string;
    total_calls: number;
  }>;
  recentLogs: Array<{
    id: number;
    action: string;
    resource_type: string;
    username: string;
    created_at: string;
  }>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching dashboard stats with token:', token ? 'exists' : 'missing');
      const response = await fetch('/api/stats/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Dashboard response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Dashboard data:', data);
        setStats(data);
        setError(null);
      } else {
        const errorData = await response.json();
        console.error('Dashboard error:', errorData);
        setError(errorData.error || 'Failed to fetch dashboard stats');
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      setError('Network error: Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const logColumns = [
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => {
        const colorMap: Record<string, string> = {
          create: 'green',
          update: 'blue',
          delete: 'red',
          login: 'cyan',
          logout: 'gray'
        };
        return <Tag color={colorMap[action] || 'default'}>{action}</Tag>;
      }
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type'
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at'
    }
  ];

  const topApiColumns = [
    {
      title: 'API名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '调用次数',
      dataIndex: 'total_calls',
      key: 'total_calls',
      render: (value: number | null) => value ?? 0
    }
  ];

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>
        <button onClick={fetchDashboardStats}>Retry</button>
      </div>
    );
  }

  if (!stats) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>No data available</div>;
  }

  return (
    <div>
      <h2>仪表盘</h2>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="API总数"
              value={stats.overview.totalApis}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="数据源总数"
              value={stats.overview.totalDatasources}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="用户总数"
              value={stats.overview.totalUsers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日调用"
              value={stats.overview.todayCalls}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="热门API" bordered={false}>
            <Table
              columns={topApiColumns}
              dataSource={stats.topApis}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近操作" bordered={false}>
            <Table
              columns={logColumns}
              dataSource={stats.recentLogs}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
