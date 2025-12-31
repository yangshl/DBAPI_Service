import React, { useEffect } from 'react';
import { Form, Input, Select, Button, Card, message, Space } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const DatasourceCreate: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [testLoading, setTestLoading] = React.useState(false);
  const navigate = useNavigate();

  const type = Form.useWatch('type', form);

  useEffect(() => {
    const defaultPorts: Record<string, number> = {
      mysql: 3306,
      postgresql: 5432,
      mssql: 1433,
      oracle: 1521
    };
    if (type && defaultPorts[type]) {
      form.setFieldsValue({ port: defaultPorts[type] });
    }
  }, [type, form]);

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      setTestLoading(true);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/datasources/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.status === 401) {
        message.error('登录已过期，请重新登录');
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      const data = await response.json();
      if (data.success) {
        message.success('连接测试成功');
      } else {
        message.error('连接测试失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('Test connection error:', error);
      message.error('请先填写完整的连接信息');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/datasources', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('创建成功');
        navigate('/datasources');
      } else {
        const data = await response.json();
        message.error(data.error || '创建失败');
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/datasources')}>
          返回
        </Button>
      </div>

      <Card title="创建数据源">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'mysql',
            port: 3306,
            status: 'active'
          }}
        >
          <Form.Item
            label="数据源名称"
            name="name"
            rules={[
              { required: true, message: '请输入数据源名称' },
              { min: 2, max: 50, message: '数据源名称长度应在2-50个字符之间' }
            ]}
          >
            <Input placeholder="例如: 生产数据库" />
          </Form.Item>

          <Form.Item
            label="数据库类型"
            name="type"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select>
              <Select.Option value="mysql">MySQL</Select.Option>
              <Select.Option value="postgresql">PostgreSQL</Select.Option>
              <Select.Option value="mssql">SQL Server</Select.Option>
              <Select.Option value="oracle">Oracle</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="主机地址"
            name="host"
            rules={[
              { required: true, message: '请输入主机地址' },
              { pattern: /^[\w.-]+$/, message: '请输入有效的主机地址' }
            ]}
          >
            <Input placeholder="localhost" />
          </Form.Item>

          <Form.Item
            label="端口"
            name="port"
            rules={[
              { required: true, message: '请输入端口' },
              {
                validator: (_, value) => {
                  const port = Number(value);
                  if (isNaN(port)) {
                    return Promise.reject('请输入有效的端口号');
                  }
                  if (port < 1 || port > 65535) {
                    return Promise.reject('端口号应在1-65535之间');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input type="number" placeholder="3306" />
          </Form.Item>

          <Form.Item
            label="数据库名称"
            name="database_name"
            rules={[
              { required: true, message: '请输入数据库名称' },
              { min: 1, max: 64, message: '数据库名称长度应在1-64个字符之间' }
            ]}
          >
            <Input placeholder="database_name" />
          </Form.Item>

          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 1, max: 32, message: '用户名长度应在1-32个字符之间' }
            ]}
          >
            <Input placeholder="root" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 1, message: '密码不能为空' }
            ]}
          >
            <Input.Password placeholder="password" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="active">活跃</Select.Option>
              <Select.Option value="inactive">停用</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                icon={<CheckCircleOutlined />}
                onClick={handleTestConnection}
                loading={testLoading}
              >
                测试连接
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSubmit}
                loading={loading}
              >
                保存
              </Button>
              <Button onClick={() => navigate('/datasources')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default DatasourceCreate;
