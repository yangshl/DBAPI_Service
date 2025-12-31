import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, message, Input, Select, Card, Row, Col, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionContext';

interface Datasource {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
  database_name: string;
  status: string;
  created_at: string;
}

const DatasourceList: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [filteredDatasources, setFilteredDatasources] = useState<Datasource[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDatasources();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [datasources, searchText, filterType, filterStatus]);

  const fetchDatasources = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/datasources', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDatasources(data);
      } else if (response.status === 401) {
        message.error('登录已过期，请重新登录');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        const errorData = await response.json().catch(() => ({}));
        message.error(errorData.error || '获取数据源列表失败');
      }
    } catch (error) {
      console.error('Failed to fetch datasources:', error);
      message.error('网络错误，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...datasources];

    if (searchText) {
      filtered = filtered.filter(ds =>
        ds.name.toLowerCase().includes(searchText.toLowerCase()) ||
        ds.host.toLowerCase().includes(searchText.toLowerCase()) ||
        ds.database_name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (filterType) {
      filtered = filtered.filter(ds => ds.type === filterType);
    }

    if (filterStatus) {
      filtered = filtered.filter(ds => ds.status === filterStatus);
    }

    setFilteredDatasources(filtered);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleTypeFilter = (value: string | undefined) => {
    setFilterType(value);
  };

  const handleStatusFilter = (value: string | undefined) => {
    setFilterStatus(value);
  };

  const handleResetFilters = () => {
    setSearchText('');
    setFilterType(undefined);
    setFilterStatus(undefined);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个数据源吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/datasources/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            message.success('删除成功');
            fetchDatasources();
          } else if (response.status === 401) {
            message.error('登录已过期，请重新登录');
            localStorage.removeItem('token');
            window.location.href = '/login';
          } else {
            const errorData = await response.json().catch(() => ({}));
            message.error(errorData.error || '删除失败');
          }
        } catch (error) {
          console.error('Delete error:', error);
          message.error('网络错误，删除失败');
        }
      }
    });
  };

  const handleTest = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/datasources/${id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        message.success('连接测试成功');
      } else {
        message.error('连接测试失败');
      }
    } catch (error) {
      console.error('Test error:', error);
      message.error('连接测试失败');
    }
  };

  const handleStatusToggle = async (id: number, checked: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/datasources/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: checked ? 'active' : 'inactive' })
      });

      if (response.ok) {
        message.success('状态更新成功');
        fetchDatasources();
      } else {
        message.error('状态更新失败');
      }
    } catch (error) {
      console.error('Status toggle error:', error);
      message.error('状态更新失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          mysql: 'blue',
          postgresql: 'cyan',
          mssql: 'orange',
          oracle: 'red'
        };
        return <Tag color={colorMap[type]}>{type.toUpperCase()}</Tag>;
      }
    },
    {
      title: '主机',
      dataIndex: 'host',
      key: 'host'
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port'
    },
    {
      title: '数据库',
      dataIndex: 'database_name',
      key: 'database_name'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Datasource) => (
        <Switch
          checked={status === 'active'}
          onChange={(checked) => handleStatusToggle(record.id, checked)}
          checkedChildren="活跃"
          unCheckedChildren="停用"
        />
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Datasource) => (
        <Space size="small">
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => handleTest(record.id)}
          >
            测试
          </Button>
          {hasPermission('datasource_edit') && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/datasources/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}
          {hasPermission('datasource_delete') && (
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            >
              删除
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>数据源管理</h2>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchDatasources}
            loading={loading}
          >
            刷新
          </Button>
          {hasPermission('datasource_create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/datasources/create')}
            >
              新建数据源
            </Button>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="搜索数据源名称、主机、数据库"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="数据库类型"
              value={filterType}
              onChange={handleTypeFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value="mysql">MySQL</Select.Option>
              <Select.Option value="postgresql">PostgreSQL</Select.Option>
              <Select.Option value="mssql">SQL Server</Select.Option>
              <Select.Option value="oracle">Oracle</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="状态"
              value={filterStatus}
              onChange={handleStatusFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value="active">活跃</Select.Option>
              <Select.Option value="inactive">停用</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button onClick={handleResetFilters} block>
              重置筛选
            </Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredDatasources}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条数据`
        }}
      />
    </div>
  );
};

export default DatasourceList;
