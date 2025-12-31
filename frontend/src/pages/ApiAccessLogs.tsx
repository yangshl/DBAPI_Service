import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, DatePicker, Select, message, Modal } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface AccessLog {
  id: number;
  api_id: number;
  api_name: string;
  api_path: string;
  user_id: number | null;
  user_name: string | null;
  ip_address: string;
  user_agent: string;
  request_params: string;
  response_status: number;
  execution_time: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

const ApiAccessLogs: React.FC = () => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '' });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    fetchLogs();
  }, [pagination.current, pagination.pageSize, filters, id]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString()
      });

      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);

      const response = await fetch(`/api/apis/${id}/access-logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.data);
        setPagination(prev => ({ ...prev, total: data.pagination.total }));
      } else {
        message.error('获取访问记录失败');
      }
    } catch (error) {
      console.error('Failed to fetch access logs:', error);
      message.error('获取访问记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setFilters({
        ...filters,
        startDate: dates[0].format('YYYY-MM-DD HH:mm:ss'),
        endDate: dates[1].format('YYYY-MM-DD HH:mm:ss')
      });
    } else {
      setFilters({
        ...filters,
        startDate: '',
        endDate: ''
      });
    }
    setPagination({ ...pagination, current: 1 });
  };

  const columns = [
    {
      title: 'API名称',
      dataIndex: 'api_name',
      key: 'api_name'
    },
    {
      title: 'API路径',
      dataIndex: 'api_path',
      key: 'api_path',
      render: (path: string) => <code>{path}</code>
    },
    {
      title: '用户',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (userName: string | null) => userName || '-'
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address'
    },
    {
      title: '请求参数',
      dataIndex: 'request_params',
      key: 'request_params',
      render: (params: string) => {
        let formattedParams = '';
        try {
          const parsed = JSON.parse(params);
          formattedParams = JSON.stringify(parsed, null, 2);
        } catch {
          formattedParams = params;
        }

        const displayParams = formattedParams.length > 100 
          ? formattedParams.substring(0, 100) + '...' 
          : formattedParams;

        return (
          <div 
            style={{ 
              fontSize: '12px', 
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: 'pointer',
              color: '#1890ff'
            }}
            onClick={() => {
              setModalContent(formattedParams);
              setModalVisible(true);
            }}
            title="点击查看完整内容"
          >
            <code>{displayParams}</code>
          </div>
        );
      }
    },
    {
      title: '响应状态',
      dataIndex: 'response_status',
      key: 'response_status',
      render: (status: number) => {
        const color = status >= 200 && status < 300 ? 'green' : 'red';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: '执行时间',
      dataIndex: 'execution_time',
      key: 'execution_time',
      render: (time: number) => `${time}ms`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'success' ? 'green' : 'red';
        return <Tag color={color}>{status === 'success' ? '成功' : '失败'}</Tag>;
      }
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      render: (errorMsg: string | null) => errorMsg || '-'
    },
    {
      title: '访问时间',
      dataIndex: 'created_at',
      key: 'created_at'
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apis')}>
          返回
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="状态筛选"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => {
              setFilters({ ...filters, status: value || '' });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failure">失败</Select.Option>
          </Select>
          <RangePicker
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            onChange={handleDateRangeChange}
          />
          <Button onClick={() => {
            setFilters({ status: '', startDate: '', endDate: '' });
            setPagination({ ...pagination, current: 1 });
          }}>
            重置筛选
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={logs}
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
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title="完整请求参数"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          fontSize: '12px',
          maxHeight: '500px',
          overflow: 'auto',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
          {modalContent}
        </pre>
      </Modal>
    </div>
  );
};

export default ApiAccessLogs;
