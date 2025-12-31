import React, { useEffect, useState } from 'react';
import { Table, Tag, DatePicker, Select, Space, Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface Log {
  id: number;
  action: string;
  resource_type: string;
  username: string;
  ip_address: string;
  status: string;
  created_at: string;
}

const LogList: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ action: '', resource_type: '', status: '', start_date: '', end_date: '' });
  
  const fetchLogs = async (page?: number, pageSize?: number, currentFilters?: typeof filters) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const currentPage = page ?? pagination.current;
      const currentPageSize = pageSize ?? pagination.pageSize;
      const currentFilterValues = currentFilters ?? filters;

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: currentPageSize.toString()
      });

      if (currentFilterValues.action) params.append('action', currentFilterValues.action);
      if (currentFilterValues.resource_type) params.append('resource_type', currentFilterValues.resource_type);
      if (currentFilterValues.status) params.append('status', currentFilterValues.status);
      if (currentFilterValues.start_date) params.append('start_date', currentFilterValues.start_date);
      if (currentFilterValues.end_date) params.append('end_date', currentFilterValues.end_date);

      const response = await fetch(`/api/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.data);
        setPagination(prev => ({ 
          ...prev, 
          total: data.pagination.total,
          totalPages: data.pagination.totalPages 
        }));
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, 15);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();

      if (filters.action) params.append('action', filters.action);
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.status) params.append('status', filters.status);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/logs/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success('导出成功');
      } else {
        message.error('导出失败');
      }
    } catch (error) {
      console.error('Export error:', error);
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
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
          logout: 'gray',
          test: 'purple'
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
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'success' ? 'green' : 'red'}>
          {status === 'success' ? '成功' : '失败'}
        </Tag>
      )
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at'
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>操作日志</h2>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExport}
          loading={exporting}
        >
          导出CSV
        </Button>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="操作类型"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => {
            const newFilters = { ...filters, action: value || '' };
            setFilters(newFilters);
            setPagination(prev => ({ ...prev, current: 1 }));
            fetchLogs(1, pagination.pageSize, newFilters);
          }}
        >
          <Select.Option value="create">创建</Select.Option>
          <Select.Option value="update">更新</Select.Option>
          <Select.Option value="delete">删除</Select.Option>
          <Select.Option value="login">登录</Select.Option>
          <Select.Option value="logout">登出</Select.Option>
        </Select>
        <Select
          placeholder="资源类型"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => {
            const newFilters = { ...filters, resource_type: value || '' };
            setFilters(newFilters);
            setPagination(prev => ({ ...prev, current: 1 }));
            fetchLogs(1, pagination.pageSize, newFilters);
          }}
        >
          <Select.Option value="api">API</Select.Option>
          <Select.Option value="datasource">数据源</Select.Option>
          <Select.Option value="user">用户</Select.Option>
        </Select>
        <Select
          placeholder="状态"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => {
            const newFilters = { ...filters, status: value || '' };
            setFilters(newFilters);
            setPagination(prev => ({ ...prev, current: 1 }));
            fetchLogs(1, pagination.pageSize, newFilters);
          }}
        >
          <Select.Option value="success">成功</Select.Option>
          <Select.Option value="failure">失败</Select.Option>
        </Select>
        <DatePicker
          placeholder="开始日期"
          onChange={(date) => {
            const newFilters = {
              ...filters,
              start_date: date ? date.format('YYYY-MM-DD') : '',
            };
            setFilters(newFilters);
            setPagination(prev => ({ ...prev, current: 1 }));
            fetchLogs(1, pagination.pageSize, newFilters);
          }}
        />
        <DatePicker
          placeholder="结束日期"
          onChange={(date) => {
            const newFilters = {
              ...filters,
              end_date: date ? date.format('YYYY-MM-DD') : '',
            };
            setFilters(newFilters);
            setPagination(prev => ({ ...prev, current: 1 }));
            fetchLogs(1, pagination.pageSize, newFilters);
          }}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          pageSizeOptions: ['15', '20', '50', '100'],
          onChange: (page, pageSize) => {
            const newPageSize = pageSize || 15;
            setPagination({ current: page, pageSize: newPageSize, total: pagination.total, totalPages: pagination.totalPages });
            fetchLogs(page, newPageSize);
          },
          onShowSizeChange: (_, size) => {
            setPagination({ current: 1, pageSize: size, total: pagination.total, totalPages: pagination.totalPages });
            fetchLogs(1, size);
          }
        }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
};

export default LogList;
