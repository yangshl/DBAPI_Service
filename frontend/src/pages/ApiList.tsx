import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, message, Input, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionContext';

interface Api {
  id: number;
  name: string;
  path: string;
  method: string;
  description: string;
  datasource_name: string;
  status: string;
  category: string;
  created_at: string;
}

interface ApiCategory {
  id: number;
  name: string;
  code: string;
  description: string;
  sort_order: number;
  status: string;
}

const ApiList: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [apis, setApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ status: '', search: '', category: '' });
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchApis();
    fetchCategories();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchApis = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString()
      });

      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);

      const response = await fetch(`/api/apis?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApis(data.data);
        setPagination(prev => ({ ...prev, total: data.pagination.total }));
      }
    } catch (error) {
      console.error('Failed to fetch APIs:', error);
      message.error('获取API列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/categories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个API吗？',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/apis/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            message.success('删除成功');
            fetchApis();
          } else {
            message.error('删除失败');
          }
        } catch (error) {
          console.error('Delete error:', error);
          message.error('删除失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => <code>{path}</code>
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => {
        const colorMap: Record<string, string> = {
          GET: 'green',
          POST: 'blue',
          PUT: 'orange',
          DELETE: 'red'
        };
        return <Tag color={colorMap[method]}>{method}</Tag>;
      }
    },
    {
      title: '数据源',
      dataIndex: 'datasource_name',
      key: 'datasource_name'
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const cat = categories.find(c => c.code === category);
        return <Tag>{cat ? cat.name : category || 'default'}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          draft: 'default',
          published: 'green',
          deprecated: 'red'
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Api) => (
        <Space size="small">
          {hasPermission('api_edit') && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/apis/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/apis/${record.id}/access-logs`)}
          >
            访问记录
          </Button>
          {hasPermission('api_delete') && (
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
        <h2>API管理</h2>
        <Space>
          <Input
            placeholder="搜索API"
            style={{ width: 200 }}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onPressEnter={() => setPagination({ ...pagination, current: 1 })}
          />
          <Select
            placeholder="状态筛选"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => {
              setFilters({ ...filters, status: value || '' });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="published">已发布</Select.Option>
            <Select.Option value="deprecated">已废弃</Select.Option>
          </Select>
          <Select
            placeholder="分类筛选"
            style={{ width: 120 }}
            allowClear
            loading={categoriesLoading}
            onChange={(value) => {
              setFilters({ ...filters, category: value || '' });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            {categories.filter(cat => cat.status === 'active').map(cat => (
              <Select.Option key={cat.code} value={cat.code}>
                {cat.name}
              </Select.Option>
            ))}
          </Select>
          {hasPermission('api_create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/apis/create')}
            >
              新建API
            </Button>
          )}
          <Button
            icon={<PlusOutlined />}
            onClick={() => navigate('/apis/auto-generate')}
          >
            自动生成API
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={apis}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize: pageSize || 10, total: pagination.total });
          }
        }}
      />
    </div>
  );
};

export default ApiList;
